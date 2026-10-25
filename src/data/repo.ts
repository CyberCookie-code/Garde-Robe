import { db, type Kind } from './db'
import type { Id, Item, Outfit, Profile, WearLog } from '../domain/types'

export const newId = () => crypto.randomUUID()
export const today = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-JJ, heure locale
const now = () => new Date().toISOString()

/** Appelé après chaque écriture locale ; la synchro s'y abonne. */
let onLocalChange = () => {}
export const setLocalChangeListener = (fn: () => void) => {
  onLocalChange = fn
}

/** Toute écriture passe par ici : elle est enregistrée dans l'outbox dans la même transaction. */
async function write<T>(kinds: Kind[], fn: (dirty: (kind: Kind, id: Id) => Promise<unknown>) => Promise<T>) {
  const result = await db.transaction('rw', [...kinds.map((k) => db[k]), db.outbox], () =>
    fn((kind, id) => db.outbox.put({ key: `${kind}:${id}`, kind, id })),
  )
  onLocalChange()
  return result
}

export const repo = {
  profiles: {
    list: () => db.profiles.toArray(),
    update: (id: Id, patch: Partial<Profile>) =>
      write(['profiles'], async (dirty) => {
        await db.profiles.update(id, { ...patch, updatedAt: now() })
        await dirty('profiles', id)
      }),
  },
  items: {
    listByOwner: (ownerId: Id) =>
      db.items.where('ownerId').equals(ownerId).filter((i) => !i.archived).reverse().sortBy('createdAt'),
    get: (id: Id) => db.items.get(id),
    bulkGet: async (ids: Id[]) => (await db.items.bulkGet(ids)).filter((i): i is Item => !!i),
    add: (item: Omit<Item, 'id' | 'createdAt' | 'wearCount' | 'archived'>) =>
      write(['items'], async (dirty) => {
        const id = newId()
        await db.items.add({ ...item, id, createdAt: now(), updatedAt: now(), wearCount: 0, archived: false })
        await dirty('items', id)
        return id
      }),
    update: (id: Id, patch: Partial<Item>) =>
      write(['items'], async (dirty) => {
        await db.items.update(id, { ...patch, updatedAt: now() })
        await dirty('items', id)
      }),
    archive: (id: Id) => repo.items.update(id, { archived: true }),
  },
  outfits: {
    listByOwner: (ownerId: Id) => db.outfits.where('ownerId').equals(ownerId).reverse().sortBy('createdAt'),
    add: (o: Omit<Outfit, 'id' | 'createdAt' | 'wearCount'>) =>
      write(['outfits'], async (dirty) => {
        const id = newId()
        await db.outfits.add({ ...o, id, createdAt: now(), updatedAt: now(), wearCount: 0 })
        await dirty('outfits', id)
        return id
      }),
    update: (id: Id, patch: Partial<Outfit>) =>
      write(['outfits'], async (dirty) => {
        await db.outfits.update(id, { ...patch, updatedAt: now() })
        await dirty('outfits', id)
      }),
    // Une ligne absente en local avec une entrée dans l'outbox = suppression à propager.
    remove: (id: Id) =>
      write(['outfits'], async (dirty) => {
        await db.outfits.delete(id)
        await dirty('outfits', id)
      }),
  },
  wear: {
    forDay: (profileId: Id, date: string) => db.wearLogs.where({ profileId, date }).first(),
    recent: (profileId: Id, limit = 30) =>
      db.wearLogs.where('profileId').equals(profileId).reverse().sortBy('date').then((l) => l.slice(0, limit)),
    /** Enregistre la tenue portée aujourd'hui et met à jour les compteurs. */
    log: (profileId: Id, outfit: Outfit, extra: Partial<WearLog> = {}) =>
      write(['wearLogs', 'outfits', 'items'], async (dirty) => {
        const date = today()
        const t = now()
        const existing = await db.wearLogs.where({ profileId, date }).first()
        if (existing) {
          await db.wearLogs.delete(existing.id)
          await dirty('wearLogs', existing.id)
        }
        const id = newId()
        await db.wearLogs.add({ id, profileId, date, outfitId: outfit.id, itemIds: outfit.itemIds, updatedAt: t, ...extra })
        await dirty('wearLogs', id)
        await db.outfits.update(outfit.id, { wearCount: outfit.wearCount + 1, lastWornAt: t, updatedAt: t })
        await dirty('outfits', outfit.id)
        for (const item of await db.items.bulkGet(outfit.itemIds)) {
          if (!item) continue
          await db.items.update(item.id, { wearCount: item.wearCount + 1, lastWornAt: t, updatedAt: t })
          await dirty('items', item.id)
        }
      }),
  },
}
