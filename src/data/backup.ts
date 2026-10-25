import { db, meta } from './db'
import type { CoupleLook, Id, Item, Outfit, Profile, WearLog } from '../domain/types'

/**
 * Sauvegarde et partage par fichier, sans serveur.
 * - « sauvegarde » : tout le contenu du téléphone, à garder en lieu sûr (iCloud Drive, Google Drive…).
 * - « partage » : une tenue (avec ses vêtements) ou une garde-robe, à envoyer à l'autre téléphone.
 * Les photos sont incluses en base64 : un fichier fait environ 100 à 150 Ko par vêtement.
 */

const FORMAT = 'garde-robe'
const VERSION = 1

type StoredItem = Omit<Item, 'photo'> & { photo?: string }

interface BackupFile {
  format: typeof FORMAT
  version: number
  kind: 'sauvegarde' | 'partage'
  exportedAt: string
  profiles: Profile[]
  items: StoredItem[]
  outfits: Outfit[]
  wearLogs: WearLog[]
  coupleLooks: CoupleLook[]
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob()

async function pack(kind: BackupFile['kind'], parts: Partial<Omit<BackupFile, 'items'>> & { items: Item[] }) {
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    profiles: parts.profiles ?? [],
    items: await Promise.all(
      parts.items.map(async ({ photo, ...i }) => ({ ...i, photo: photo ? await blobToDataUrl(photo) : undefined })),
    ),
    outfits: parts.outfits ?? [],
    wearLogs: parts.wearLogs ?? [],
    coupleLooks: parts.coupleLooks ?? [],
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

const stamp = () => new Date().toLocaleDateString('sv-SE')

export async function exportAll() {
  const [profiles, items, outfits, wearLogs, coupleLooks] = await Promise.all([
    db.profiles.toArray(),
    db.items.toArray(),
    db.outfits.toArray(),
    db.wearLogs.toArray(),
    db.coupleLooks.toArray(),
  ])
  const blob = await pack('sauvegarde', { profiles, items, outfits, wearLogs, coupleLooks })
  return { blob, name: `garde-robe-sauvegarde-${stamp()}.json` }
}

export async function exportOutfit(outfitId: Id) {
  const outfit = await db.outfits.get(outfitId)
  if (!outfit) throw new Error('Tenue introuvable')
  const items = (await db.items.bulkGet(outfit.itemIds)).filter((i): i is Item => !!i)
  const profiles = (await db.profiles.where('id').equals(outfit.ownerId).toArray())
  const blob = await pack('partage', { profiles, items, outfits: [outfit] })
  return { blob, name: `tenue-${slug(outfit.name)}.json` }
}

export async function exportWardrobe(profileId: Id) {
  const [profiles, items, outfits] = await Promise.all([
    db.profiles.where('id').equals(profileId).toArray(),
    db.items.where('ownerId').equals(profileId).filter((i) => !i.archived).toArray(),
    db.outfits.where('ownerId').equals(profileId).toArray(),
  ])
  const blob = await pack('partage', { profiles, items, outfits })
  return { blob, name: `garde-robe-${slug(profiles[0]?.name ?? profileId)}-${stamp()}.json` }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'export'

export interface ImportResult {
  kind: BackupFile['kind']
  items: number
  outfits: number
  wearLogs: number
}

/**
 * Fusionne le fichier dans le téléphone : les objets de même identifiant sont remplacés,
 * rien n'est supprimé. Les prénoms ne sont repris que d'une sauvegarde complète,
 * pour qu'un partage ne renomme pas les profils de l'autre téléphone.
 */
export async function importFile(file: File): Promise<ImportResult> {
  let data: BackupFile
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde de l'app.")
  }
  if (data.format !== FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde de l'app.")
  if (data.version > VERSION) throw new Error("Ce fichier vient d'une version plus récente de l'app : mets-la à jour.")

  const items: Item[] = await Promise.all(
    data.items.map(async ({ photo, ...i }) => ({ ...i, photo: photo ? await dataUrlToBlob(photo) : undefined })),
  )
  await db.transaction('rw', [db.profiles, db.items, db.outfits, db.wearLogs, db.coupleLooks], async () => {
    for (const p of data.profiles) {
      if (data.kind === 'sauvegarde' || !(await db.profiles.get(p.id))) await db.profiles.put(p)
    }
    await db.items.bulkPut(items)
    await db.outfits.bulkPut(data.outfits)
    await db.wearLogs.bulkPut(data.wearLogs)
    await db.coupleLooks.bulkPut(data.coupleLooks)
  })
  return { kind: data.kind, items: items.length, outfits: data.outfits.length, wearLogs: data.wearLogs.length }
}

/** Ouvre la feuille de partage du téléphone (AirDrop, Messages, WhatsApp, Fichiers…), sinon télécharge. */
export async function shareOrDownload({ blob, name }: { blob: Blob; name: string }, title: string) {
  const file = new File([blob], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'partagé'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annulé'
      // sinon on retombe sur le téléchargement
    }
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'téléchargé'
}

export const lastBackup = {
  get: () => meta.get('lastBackupAt'),
  mark: () => meta.set('lastBackupAt', new Date().toISOString()),
}

/** Demande au navigateur de ne pas effacer les données (accordé d'office à une app installée sur Android). */
export async function requestPersistence() {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
