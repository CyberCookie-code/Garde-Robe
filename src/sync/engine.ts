import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, meta, SYNCED_KINDS, type Kind } from '../data/db'
import { setLocalChangeListener } from '../data/repo'
import type { Item } from '../domain/types'
import { supabase } from './client'

/**
 * Synchro « local d'abord » :
 * - l'UI lit et écrit IndexedDB, chaque écriture laisse une entrée dans l'outbox ;
 * - push : on envoie l'outbox vers la table `records` (+ photos dans Storage) ;
 * - pull : on récupère les lignes modifiées depuis la dernière fois ;
 * - conflit : la dernière écriture gagne, sauf qu'une modification locale pas encore
 *   envoyée n'est jamais écrasée par le pull.
 */

export interface SyncState {
  configured: boolean
  email?: string
  householdId?: string
  inviteCode?: string
  status: 'off' | 'idle' | 'syncing' | 'offline' | 'error'
  pending: number
  lastSyncAt?: string
  error?: string
}

let state: SyncState = { configured: !!supabase, status: 'off', pending: 0 }
const listeners = new Set<() => void>()
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const syncStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

const PULL_OVERLAP_MS = 5000
const photoPathOf = (householdId: string, itemId: string) => `${householdId}/${itemId}.jpg`

// --- push ------------------------------------------------------------------

async function push(householdId: string) {
  const sb = supabase!
  for (const entry of await db.outbox.toArray()) {
    const local = await db[entry.kind].get(entry.id)
    let data: Record<string, unknown> | null = null
    if (local) {
      const { photo, ...rest } = local as Item
      data = rest
      if (entry.kind === 'items' && photo && !rest.photoPath) {
        const path = photoPathOf(householdId, entry.id)
        const { error } = await sb.storage.from('photos').upload(path, photo, { upsert: true, contentType: 'image/jpeg' })
        if (error) throw error
        data.photoPath = path
        await db.items.update(entry.id, { photoPath: path })
      }
    }
    const { error } = await sb
      .from('records')
      .upsert({ household_id: householdId, kind: entry.kind, id: entry.id, data, deleted: !local })
    if (error) throw error
    // Ne retirer de l'outbox que si rien n'a changé pendant l'envoi.
    await db.transaction('rw', db.outbox, db[entry.kind], async () => {
      const again = (await db[entry.kind].get(entry.id)) as { updatedAt?: string } | undefined
      if ((again?.updatedAt ?? null) === ((local as { updatedAt?: string } | undefined)?.updatedAt ?? null))
        await db.outbox.delete(entry.key)
    })
  }
}

// --- pull ------------------------------------------------------------------

interface RemoteRecord {
  kind: Kind
  id: string
  data: Record<string, unknown> | null
  deleted: boolean
  updated_at: string
}

async function pull(householdId: string) {
  const sb = supabase!
  const cursorKey = `lastPull:${householdId}`
  const since = await meta.get(cursorKey)
  let query = sb.from('records').select('kind,id,data,deleted,updated_at').eq('household_id', householdId)
  if (since) query = query.gt('updated_at', new Date(Date.parse(since) - PULL_OVERLAP_MS).toISOString())
  const { data, error } = await query.order('updated_at').limit(5000)
  if (error) throw error
  const rows = (data ?? []) as RemoteRecord[]

  for (const r of rows) {
    if (!SYNCED_KINDS.includes(r.kind)) continue
    if (await db.outbox.get(`${r.kind}:${r.id}`)) continue // modification locale en attente : elle gagne
    const table = db[r.kind]
    if (r.deleted || !r.data) {
      await table.delete(r.id)
      continue
    }
    if (r.kind === 'items') {
      const remote = r.data as unknown as Item
      const local = await db.items.get(r.id)
      let photo = local?.photoPath === remote.photoPath ? local?.photo : undefined
      if (!photo && remote.photoPath) {
        const dl = await sb.storage.from('photos').download(remote.photoPath)
        if (!dl.error) photo = dl.data
      }
      await db.items.put({ ...remote, photo })
    } else {
      await (table as typeof db.outfits).put(r.data as never)
    }
  }
  if (rows.length) await meta.set(cursorKey, rows[rows.length - 1].updated_at)
  return rows
}

// --- orchestration ---------------------------------------------------------

let running: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = 5000
let again = false

export function syncNow(): Promise<void> {
  if (!supabase || !state.householdId) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  const hid = state.householdId
  running = (async () => {
    set({ status: 'syncing', error: undefined })
    try {
      do {
        again = false
        await push(hid)
        await pull(hid)
      } while (again)
      set({ status: 'idle', lastSyncAt: new Date().toISOString(), pending: await db.outbox.count() })
      retryDelay = 5000
    } catch (e) {
      const offline = !navigator.onLine || (e instanceof TypeError && /fetch/i.test(e.message))
      set({
        status: offline ? 'offline' : 'error',
        error: e instanceof Error ? e.message : String(e),
        pending: await db.outbox.count(),
      })
      // Nouvel essai automatique, de plus en plus espacé (5 s → 5 min).
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => void syncNow(), retryDelay)
      retryDelay = Math.min(retryDelay * 2, 300_000)
    } finally {
      running = null
    }
  })()
  return running
}

let pushTimer: ReturnType<typeof setTimeout> | undefined
setLocalChangeListener(() => {
  void db.outbox.count().then((pending) => set({ pending }))
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void syncNow(), 800)
})

let channel: RealtimeChannel | null = null
function listenRemote(householdId: string) {
  void channel?.unsubscribe()
  channel = supabase!
    .channel(`records:${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `household_id=eq.${householdId}` }, () =>
      void syncNow(),
    )
    .subscribe((status) => {
      // Rattrapage de ce qui a pu changer pendant que l'abonnement s'établissait.
      if (status === 'SUBSCRIBED') void syncNow()
    })
}

/**
 * Première connexion de ce téléphone à un foyer : on récupère d'abord le foyer,
 * puis on y ajoute tout ce qui a été saisi en local.
 */
async function linkDevice(householdId: string) {
  const linkedKey = `linked:${householdId}`
  if (await meta.get(linkedKey)) return
  const remote = await pull(householdId)
  const remoteHasProfiles = remote.some((r) => r.kind === 'profiles')
  for (const kind of SYNCED_KINDS) {
    if (kind === 'profiles' && remoteHasProfiles) continue
    const keys = (await db[kind].toCollection().primaryKeys()) as string[]
    await db.outbox.bulkPut(keys.map((id) => ({ key: `${kind}:${id}`, kind, id })))
  }
  await meta.set(linkedKey, new Date().toISOString())
}

async function loadHousehold() {
  const sb = supabase!
  const { data: user } = await sb.auth.getUser()
  if (!user.user) {
    set({ email: undefined, householdId: undefined, inviteCode: undefined, status: 'off' })
    return
  }
  set({ email: user.user.email })
  const { data, error } = await sb.from('households').select('id, invite_code').maybeSingle()
  if (error) return set({ status: 'error', error: error.message })
  if (!data) return set({ householdId: undefined, inviteCode: undefined, status: 'off' })
  set({ householdId: data.id, inviteCode: data.invite_code })
  await linkDevice(data.id)
  listenRemote(data.id)
  await syncNow()
}

let started = false
export async function startSync() {
  if (!supabase || started) return
  started = true
  let lastUser: string | undefined
  supabase.auth.onAuthStateChange((_event, session) => {
    // Ne pas appeler Supabase directement dans ce callback (risque de blocage) : on diffère.
    if (session?.user.id === lastUser) return
    lastUser = session?.user.id
    setTimeout(() => void loadHousehold(), 0)
  })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow())
  window.addEventListener('online', () => void syncNow())
  // Filet de sécurité si le temps réel décroche (fréquent sur mobile en arrière-plan).
  setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60_000)
  set({ pending: await db.outbox.count() })
}

// --- actions du compte -----------------------------------------------------

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message)
}

export const account = {
  signIn: async (email: string, password: string) =>
    fail((await supabase!.auth.signInWithPassword({ email, password })).error),
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase!.auth.signUp({ email, password })
    fail(error)
    return { needsConfirmation: !data.session }
  },
  signOut: async () => {
    void channel?.unsubscribe()
    fail((await supabase!.auth.signOut()).error)
  },
  createHousehold: async () => {
    fail((await supabase!.rpc('create_household')).error)
    await loadHousehold()
  },
  joinHousehold: async (code: string) => {
    fail((await supabase!.rpc('join_household', { code })).error)
    await loadHousehold()
  },
}
