import { db } from './db'
import type { Id, Item, Outfit, Profile, WearLog } from '../domain/types'

export const newId = () => crypto.randomUUID()
export const today = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-JJ, heure locale

export const repo = {
  profiles: {
    list: () => db.profiles.toArray(),
    update: (id: Id, patch: Partial<Profile>) => db.profiles.update(id, patch),
  },
  items: {
    listByOwner: (ownerId: Id) =>
      db.items.where('ownerId').equals(ownerId).filter((i) => !i.archived).reverse().sortBy('createdAt'),
    get: (id: Id) => db.items.get(id),
    bulkGet: async (ids: Id[]) => (await db.items.bulkGet(ids)).filter((i): i is Item => !!i),
    add: (item: Omit<Item, 'id' | 'createdAt' | 'wearCount' | 'archived'>) =>
      db.items.add({ ...item, id: newId(), createdAt: new Date().toISOString(), wearCount: 0, archived: false }),
    update: (id: Id, patch: Partial<Item>) => db.items.update(id, patch),
    archive: (id: Id) => db.items.update(id, { archived: true }),
  },
  outfits: {
    listByOwner: (ownerId: Id) => db.outfits.where('ownerId').equals(ownerId).reverse().sortBy('createdAt'),
    add: (o: Omit<Outfit, 'id' | 'createdAt' | 'wearCount'>) =>
      db.outfits.add({ ...o, id: newId(), createdAt: new Date().toISOString(), wearCount: 0 }),
    update: (id: Id, patch: Partial<Outfit>) => db.outfits.update(id, patch),
    remove: (id: Id) => db.outfits.delete(id),
  },
  wear: {
    forDay: (profileId: Id, date: string) => db.wearLogs.where({ profileId, date }).first(),
    recent: (profileId: Id, limit = 30) =>
      db.wearLogs.where('profileId').equals(profileId).reverse().sortBy('date').then((l) => l.slice(0, limit)),
    /** Enregistre la tenue portée aujourd'hui et met à jour les compteurs. */
    async log(profileId: Id, outfit: Outfit, extra: Partial<WearLog> = {}) {
      const date = today()
      const now = new Date().toISOString()
      await db.transaction('rw', db.wearLogs, db.outfits, db.items, async () => {
        const existing = await db.wearLogs.where({ profileId, date }).first()
        if (existing) await db.wearLogs.delete(existing.id)
        await db.wearLogs.add({ id: newId(), profileId, date, outfitId: outfit.id, itemIds: outfit.itemIds, ...extra })
        await db.outfits.update(outfit.id, { wearCount: outfit.wearCount + 1, lastWornAt: now })
        for (const item of await db.items.bulkGet(outfit.itemIds)) {
          if (item) await db.items.update(item.id, { wearCount: item.wearCount + 1, lastWornAt: now })
        }
      })
    },
  },
}
