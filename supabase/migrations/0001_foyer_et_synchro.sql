-- Synchro « Je mets quoi ? » : un foyer partagé par deux comptes.
-- À exécuter une fois dans Supabase > SQL Editor.

create extension if not exists pgcrypto;

-- Foyer et membres --------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id) -- un compte appartient à un seul foyer
);

create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid())
$$;

-- Données synchronisées ---------------------------------------------------
-- Une seule table « documents » : kind = profiles | items | outfits | wearLogs | coupleLooks,
-- data = l'objet tel que l'app le stocke (sans la photo, rangée dans Storage).

create table public.records (
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('profiles', 'items', 'outfits', 'wearLogs', 'coupleLooks')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, kind, id)
);
create index records_pull_idx on public.records (household_id, updated_at);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

create trigger records_touch before insert or update on public.records
for each row execute function public.touch_updated_at();

-- Sécurité (RLS) ----------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;

create policy "membres lisent leur foyer" on public.households
  for select using (public.is_member(id));
create policy "membres voient les membres" on public.household_members
  for select using (public.is_member(household_id));
create policy "membres lisent" on public.records
  for select using (public.is_member(household_id));
create policy "membres créent" on public.records
  for insert with check (public.is_member(household_id));
create policy "membres modifient" on public.records
  for update using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Créer / rejoindre un foyer (seul moyen d'écrire dans households / members)

create or replace function public.create_household() returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'déjà dans un foyer';
  end if;
  insert into households default values returning * into h;
  insert into household_members (household_id, user_id) values (h.id, auth.uid());
  return h;
end $$;

create or replace function public.join_household(code text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select * into h from households where invite_code = upper(trim(code));
  if h.id is null then raise exception 'code invalide'; end if;
  if (select count(*) from household_members where household_id = h.id) >= 2 then
    raise exception 'foyer complet';
  end if;
  insert into household_members (household_id, user_id) values (h.id, auth.uid())
    on conflict do nothing;
  return h;
end $$;

revoke execute on function public.create_household() from anon;
revoke execute on function public.join_household(text) from anon;

-- Temps réel : l'autre téléphone est prévenu des changements.
alter publication supabase_realtime add table public.records;

-- Photos ------------------------------------------------------------------
-- Bucket privé, un dossier par foyer : photos/<household_id>/<item_id>.jpg

insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;

create policy "photos lecture" on storage.objects for select
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "photos ajout" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "photos remplacement" on storage.objects for update
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
