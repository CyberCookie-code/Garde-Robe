import { db } from './db'
import { ME, type Id, type Item, type Outfit, type Owner, type WearLog } from '../domain/types'

export const newId = () => crypto.randomUUID()
export const today = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-JJ, heure locale

export const repo = {
  items: {
    list: (owner: Owner = ME) =>
      db.items.where('ownerId').equals(owner).filter((i) => !i.archived).reverse().sortBy('createdAt'),
    /** Tous les vêtements, reçus compris (pour afficher les tenues reçues). */
    all: () => db.items.filter((i) => !i.archived).toArray(),
    get: (id: Id) => db.items.get(id),
    add: (item: Omit<Item, 'id' | 'ownerId' | 'createdAt' | 'wearCount' | 'archived'>) =>
      db.items.add({ ...item, id: newId(), ownerId: ME, createdAt: new Date().toISOString(), wearCount: 0, archived: false }),
    update: (id: Id, patch: Partial<Item>) => db.items.update(id, patch),
    archive: (id: Id) => db.items.update(id, { archived: true }),
  },
  outfits: {
    list: (owner: Owner = ME) => db.outfits.where('ownerId').equals(owner).reverse().sortBy('createdAt'),
    count: (owner: Owner) => db.outfits.where('ownerId').equals(owner).count(),
    add: (o: Omit<Outfit, 'id' | 'ownerId' | 'createdAt' | 'wearCount'>) =>
      db.outfits.add({ ...o, id: newId(), ownerId: ME, createdAt: new Date().toISOString(), wearCount: 0 }),
    update: (id: Id, patch: Partial<Outfit>) => db.outfits.update(id, patch),
    remove: (id: Id) => db.outfits.delete(id),
    restore: (o: Outfit) => db.outfits.put(o),
  },
  wear: {
    forDay: (date: string) => db.wearLogs.where({ profileId: ME, date }).first(),
    recent: (limit = 30) =>
      db.wearLogs.where('profileId').equals(ME).reverse().sortBy('date').then((l) => l.slice(0, limit)),
    /** Enregistre la tenue portée aujourd'hui et met à jour les compteurs. */
    async log(outfit: Outfit, extra: Partial<WearLog> = {}) {
      const date = today()
      await db.transaction('rw', db.wearLogs, db.outfits, db.items, async () => {
        await undoDay(date)
        const now = new Date().toISOString()
        const fresh = (await db.outfits.get(outfit.id)) ?? outfit
        await db.wearLogs.add({ id: newId(), profileId: ME, date, outfitId: outfit.id, itemIds: outfit.itemIds, ...extra })
        await db.outfits.update(outfit.id, { wearCount: fresh.wearCount + 1, lastWornAt: now })
        for (const item of await db.items.bulkGet(outfit.itemIds)) {
          if (item) await db.items.update(item.id, { wearCount: item.wearCount + 1, lastWornAt: now })
        }
      })
    },
    /** Annule « Je la porte » pour aujourd'hui. */
    undo: () => db.transaction('rw', db.wearLogs, db.outfits, db.items, () => undoDay(today())),
  },
}

async function undoDay(date: string) {
  const log = await db.wearLogs.where({ profileId: ME, date }).first()
  if (!log) return
  await db.wearLogs.delete(log.id)
  if (log.outfitId) {
    const o = await db.outfits.get(log.outfitId)
    if (o) await db.outfits.update(o.id, { wearCount: Math.max(0, o.wearCount - 1) })
  }
  for (const item of await db.items.bulkGet(log.itemIds)) {
    if (item) await db.items.update(item.id, { wearCount: Math.max(0, item.wearCount - 1) })
  }
}
