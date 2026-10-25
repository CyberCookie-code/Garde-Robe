import Dexie, { type EntityTable } from 'dexie'
import type { CoupleLook, Item, Outfit, Profile, WearLog } from '../domain/types'

/** Tables synchronisées avec Supabase (même nom que `records.kind`). */
export const SYNCED_KINDS = ['profiles', 'items', 'outfits', 'wearLogs', 'coupleLooks'] as const
export type Kind = (typeof SYNCED_KINDS)[number]

/** Modification locale pas encore envoyée au serveur. */
export interface OutboxEntry {
  key: string // `${kind}:${id}`
  kind: Kind
  id: string
}

// IndexedDB reste la source de vérité de l'UI (rapide, hors-ligne). La synchro
// (src/sync) recopie les changements vers Supabase et ramène ceux de l'autre téléphone.
export const db = new Dexie('garde-robe') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  items: EntityTable<Item, 'id'>
  outfits: EntityTable<Outfit, 'id'>
  wearLogs: EntityTable<WearLog, 'id'>
  coupleLooks: EntityTable<CoupleLook, 'id'>
  outbox: EntityTable<OutboxEntry, 'key'>
  meta: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  profiles: 'id',
  items: 'id, ownerId, category, archived, createdAt',
  outfits: 'id, ownerId, favorite, createdAt',
  wearLogs: 'id, profileId, date, [profileId+date]',
  coupleLooks: 'id, createdAt',
})

db.version(2).stores({
  outbox: 'key',
  meta: 'key',
})

export async function ensureDefaultProfiles() {
  if ((await db.profiles.count()) > 0) return
  await db.profiles.bulkAdd([
    { id: 'lui', name: 'Maxime', accent: '#3a6fd8' },
    { id: 'elle', name: 'Elle', accent: '#d64f86' },
  ])
}

export const meta = {
  get: async (key: string) => (await db.meta.get(key))?.value,
  set: (key: string, value: string) => db.meta.put({ key, value }),
  del: (key: string) => db.meta.delete(key),
}
