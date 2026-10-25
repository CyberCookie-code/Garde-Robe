import Dexie, { type EntityTable } from 'dexie'
import { ME, type CoupleLook, type Item, type Outfit, type Profile, type WearLog } from '../domain/types'
import { ownerMapper, pickMainOwner } from './migrate'

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

// v3 : un seul profil par téléphone (voir ./migrate).
db.version(3)
  .stores({})
  .upgrade(async (tx) => {
    let preferred: string | null = null
    try {
      preferred = localStorage.getItem('profile')
      localStorage.removeItem('profile')
    } catch {
      /* navigation privée */
    }
    const owners = (await tx.table('items').toArray()).map((i: { ownerId: string }) => i.ownerId)
    const map = ownerMapper(pickMainOwner(owners, preferred))
    await tx.table('items').toCollection().modify((i: { ownerId: string }) => {
      i.ownerId = map(i.ownerId)
    })
    await tx.table('outfits').toCollection().modify((o: { ownerId: string }) => {
      o.ownerId = map(o.ownerId)
    })
    await tx.table('wearLogs').toCollection().modify((w: { profileId: string }) => {
      w.profileId = map(w.profileId)
    })
    await tx.table('profiles').clear()
    await tx.table('profiles').add({ id: ME })
  })

export const meta = {
  get: async (key: string) => (await db.meta.get(key))?.value,
  set: (key: string, value: string) => db.meta.put({ key, value }),
}

export async function ensureProfile() {
  if (!(await db.profiles.get(ME))) await db.profiles.put({ id: ME })
}
