import Dexie, { type EntityTable } from 'dexie'
import type { CoupleLook, Item, Outfit, Profile, WearLog } from '../domain/types'

// Stockage local (IndexedDB) : chaque téléphone a sa propre garde-robe. Toute l'UI passe par ./repo.
// Sauvegarde et partage entre téléphones : fichiers JSON, voir ./backup.
export const db = new Dexie('garde-robe') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  items: EntityTable<Item, 'id'>
  outfits: EntityTable<Outfit, 'id'>
  wearLogs: EntityTable<WearLog, 'id'>
  coupleLooks: EntityTable<CoupleLook, 'id'>
  meta: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  profiles: 'id',
  items: 'id, ownerId, category, archived, createdAt',
  outfits: 'id, ownerId, favorite, createdAt',
  wearLogs: 'id, profileId, date, [profileId+date]',
  coupleLooks: 'id, createdAt',
})

db.version(2).stores({ meta: 'key' })

export const meta = {
  get: async (key: string) => (await db.meta.get(key))?.value,
  set: (key: string, value: string) => db.meta.put({ key, value }),
}

export async function ensureDefaultProfiles() {
  if ((await db.profiles.count()) > 0) return
  await db.profiles.bulkAdd([
    { id: 'lui', name: 'Maxime', accent: '#3a6fd8' },
    { id: 'elle', name: 'Elle', accent: '#d64f86' },
  ])
}
