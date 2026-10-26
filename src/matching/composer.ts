import type { Category, ColorTag, Item, Outfit } from '../domain/types'
import { byMaterial, byOccasion, byWeather, dayHash, type MatchContext } from './engine'

/**
 * Composeur de tenues : assemble lui-même des tenues complètes à partir des vêtements,
 * sans passer par les tenues enregistrées.
 *
 * Tout tourne sur le téléphone, avec des règles de stylisme classiques :
 * une seule couleur forte sur des neutres, couleurs voisines ou complémentaires,
 * un seul motif, un niveau d'habillé cohérent, la bonne couche pour la météo.
 * Les règles ne voient ni la coupe ni la photo : elles ne valent que ce que valent
 * les couleurs, matières et niveaux saisis sur chaque vêtement.
 */

export interface Idea {
  /** Clé stable : ids des pièces triés. Sert à refuser une idée ou à repérer un doublon. */
  key: string
  name: string
  items: Item[]
  score: number
  /** Ce qui fait que ça marche, du plus fort au plus faible. */
  reasons: string[]
  /** Ce qui coince encore, le cas échéant. */
  warnings: string[]
}

interface Note {
  score: number
  reason?: string
}

export const ideaKey = (ids: string[]) => [...ids].sort().join('+')

const CORE: Category[] = ['haut', 'bas', 'robe']
const isCore = (i: Item) => CORE.includes(i.category)

// ---------- Couleurs ----------

function hsl(hex: string) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}

/**
 * Noir, blanc, gris, beige, mais aussi marine, denim, kaki et les marrons :
 * les couleurs qui se portent avec à peu près tout.
 */
export function isNeutral(c: ColorTag) {
  if (c.family === 'neutre' || c.family === 'marron') return true
  const { s, l } = hsl(c.hex)
  return s < 0.35 || l < 0.25
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

const lower = (c: ColorTag) => c.name.toLowerCase()

function byColors(items: Item[]): Note {
  const main = items.map((i) => i.colors[0]).filter((c): c is ColorTag => !!c)
  if (main.length < 2) return { score: 0 }
  const vivid = main.filter((c) => !isNeutral(c))
  if (vivid.length === 0) return { score: 1, reason: 'base neutre, facile à porter' }
  // Regroupe les couleurs vives de teinte proche (rouge et bordeaux, bleu et ciel…).
  const groups: ColorTag[][] = []
  for (const c of vivid) {
    const g = groups.find((x) => hueGap(hsl(x[0].hex).h, hsl(c.hex).h) <= 30)
    if (g) g.push(c)
    else groups.push([c])
  }
  if (groups.length === 1) {
    const [g] = groups
    return g.length === 1
      ? { score: 3, reason: `touche de ${lower(g[0])} sur des neutres` }
      : { score: 2, reason: `ton sur ton ${lower(g[0])}` }
  }
  if (groups.length === 2) {
    const [a, b] = groups.map((g) => g[0])
    const gap = hueGap(hsl(a.hex).h, hsl(b.hex).h)
    const names = `${lower(a)} et ${lower(b)}`
    if (gap <= 60) return { score: 2, reason: `${names}, couleurs voisines` }
    if (gap >= 150) return { score: 1, reason: `${names}, contraste franc` }
    return { score: -3, reason: `${names} se marient mal` }
  }
  return { score: -4, reason: 'trop de couleurs vives' }
}

// ---------- Motifs, style, saison, répétitions ----------

function byPattern(items: Item[]): Note {
  const patterned = items.filter((i) => i.pattern !== 'uni' && i.category !== 'chaussures')
  if (patterned.length >= 2) return { score: -3, reason: 'deux motifs qui se concurrencent' }
  if (patterned.length === 1 && items.length >= 3) return { score: 1, reason: 'un seul motif, le reste calme' }
  return { score: 0 }
}

function byStyle(items: Item[]): Note {
  const f = items.map((i) => i.formality)
  const spread = Math.max(...f) - Math.min(...f)
  if (spread >= 3) return { score: -4, reason: 'mélange trop habillé et trop décontracté' }
  if (spread === 2) return { score: -1 }
  return { score: 1, reason: 'style cohérent' }
}

function bySeason(items: Item[], ctx: MatchContext): Note[] {
  return items
    .filter((i) => i.seasons.length > 0 && !i.seasons.includes(ctx.season))
    .map((i) => ({ score: -2, reason: `${i.name} hors saison` }))
}

function byRecentItems(items: Item[], recent: Set<string>): Note[] {
  return items
    .filter((i) => isCore(i) && recent.has(i.id))
    .map((i) => ({ score: -2, reason: `${i.name} déjà porté ces jours-ci` }))
}

// ---------- Couches et météo ----------

interface Wardrobe {
  hasCoat: boolean
  hasJacket: boolean
}

function byLayers(items: Item[], ctx: MatchContext, w: Wardrobe): Note {
  const coat = items.some((i) => i.category === 'manteau')
  const jacket = items.find((i) => i.category === 'veste')
  const t = ctx.weather?.tempC
  if (t !== undefined) {
    if (t >= 22 && coat) return { score: -5, reason: 'manteau inutile par cette chaleur' }
    if (t >= 22 && jacket && jacket.warmth >= 3) return { score: -3, reason: `${jacket.name} trop chaud aujourd’hui` }
    if (t < 10 && !coat && w.hasCoat) return { score: -4, reason: 'il manque un manteau' }
    if (t < 16 && !coat && !jacket && (w.hasCoat || w.hasJacket)) return { score: -2, reason: 'une couche de plus serait bienvenue' }
    if (ctx.weather?.rain && items.some((i) => i.waterproof && (i.category === 'manteau' || i.category === 'veste')))
      return { score: 2, reason: 'protégé de la pluie' }
    return { score: 0 }
  }
  if (ctx.season === 'ete' && coat) return { score: -4, reason: 'manteau en plein été' }
  if (ctx.season === 'hiver' && !coat && w.hasCoat) return { score: -2, reason: 'il manque un manteau' }
  return { score: 0 }
}

/** Les critères météo, occasion et matières du moteur, appliqués à une tenue composée. */
function engineNotes(items: Item[], ctx: MatchContext): Note[] {
  const outfit: Outfit = {
    id: '',
    ownerId: 'moi',
    name: '',
    itemIds: items.map((i) => i.id),
    seasons: [],
    occasions: [],
    moods: [],
    favorite: false,
    source: 'regles',
    wearCount: 0,
    createdAt: '',
  }
  return [byWeather, byOccasion, byMaterial].map((c) => c(outfit, ctx))
}

// ---------- Assemblage ----------

export interface ComposeOptions {
  /** Tenues déjà enregistrées : leur haut + bas (ou robe) n'est pas reproposé. */
  saved?: string[][]
  /** Clés d'idées refusées : leur haut + bas (ou robe) n'est plus reproposé. */
  refused?: string[]
  /** Nombre maximum d'idées. */
  limit?: number
}

function scoreCombo(items: Item[], ctx: MatchContext, w: Wardrobe, recent: Set<string>) {
  const notes: Note[] = [
    byColors(items),
    byPattern(items),
    byStyle(items),
    byLayers(items, ctx, w),
    ...bySeason(items, ctx),
    ...byRecentItems(items, recent),
    ...engineNotes(items, ctx),
  ]
  const score = notes.reduce((s, n) => s + n.score, 0)
  const reasons = notes
    .filter((n) => n.reason && n.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((n) => n.reason!)
  const warnings = notes
    .filter((n) => n.reason && n.score <= -2)
    .sort((a, b) => a.score - b.score)
    .map((n) => n.reason!)
  return { score, reasons: [...new Set(reasons)].slice(0, 3), warnings }
}

const by = (items: Item[], c: Category) => items.filter((i) => i.category === c)

/** Ce qu'il manque pour composer une tenue, ou null si c'est possible. */
export function missingForCompose(items: Item[]): string | null {
  const has = (c: Category) => items.some((i) => i.category === c)
  if (has('robe') || (has('haut') && has('bas'))) return null
  if (has('haut')) return 'Ajoute au moins un bas (pantalon, jupe, short) pour que l’app compose des tenues.'
  if (has('bas')) return 'Ajoute au moins un haut pour que l’app compose des tenues.'
  return 'Ajoute au moins un haut et un bas, ou une robe, pour que l’app compose des tenues.'
}

const MIN_SCORE = -6

export function composeOutfits(items: Item[], ctx: MatchContext, opts: ComposeOptions = {}): Idea[] {
  const { saved = [], refused = [], limit = 12 } = opts
  const tops = by(items, 'haut')
  const bottoms = by(items, 'bas')
  const dresses = by(items, 'robe')
  const jackets = by(items, 'veste')
  const coats = by(items, 'manteau')
  const shoes = by(items, 'chaussures')
  const w: Wardrobe = { hasCoat: coats.length > 0, hasJacket: jackets.length > 0 }
  const recent = new Set(ctx.recentWear.slice(0, 3).flatMap((l) => l.itemIds))
  // Une association déjà enregistrée ou refusée ne revient pas, même avec d'autres chaussures ou une autre veste.
  const isCoreId = (id: string) => {
    const i = ctx.items.get(id)
    return !!i && isCore(i)
  }
  const coreKey = (ids: string[]) => ideaKey(ids.filter(isCoreId))
  const skip = new Set([...saved, ...refused.map((k) => k.split('+'))].map(coreKey))

  // 1. Bases : haut + bas, ou robe. On garde les plus prometteuses pour limiter les calculs.
  let bases: Item[][] = [...tops.flatMap((t) => bottoms.map((b) => [t, b])), ...dresses.map((d) => [d])]
  if (bases.length > 60) {
    bases = bases
      .map((b) => ({ b, s: byColors(b).score + byPattern(b).score + byStyle(b).score }))
      .sort((x, y) => y.s - x.s)
      .slice(0, 60)
      .map((x) => x.b)
  }

  // 2. Couches possibles : rien, une veste, un manteau, ou les deux quand il fait froid.
  const cold = ctx.weather ? ctx.weather.tempC < 10 : ctx.season === 'hiver'
  const layers: Item[][] = [
    [],
    ...jackets.map((j) => [j]),
    ...coats.map((c) => [c]),
    ...(cold ? jackets.flatMap((j) => coats.map((c) => [j, c])) : []),
  ]
  const shoeOptions: Item[][] = shoes.length ? shoes.map((s) => [s]) : [[]]

  const all: Idea[] = []
  for (const base of bases) {
    if (skip.has(ideaKey(base.map((i) => i.id)))) continue
    for (const layer of layers)
      for (const shoe of shoeOptions) {
        const pieces = [...base, ...layer, ...shoe]
        const key = ideaKey(pieces.map((i) => i.id))
        const r = scoreCombo(pieces, ctx, w, recent)
        if (r.score < MIN_SCORE) continue
        all.push({ key, name: nameOf(base), items: pieces, ...r, score: r.score + dayHash(ctx.date + key) })
      }
  }
  all.sort((a, b) => b.score - a.score)

  // 3. Des idées variées : un haut + bas n'apparaît qu'une fois (avec sa meilleure veste et ses meilleures
  //    chaussures), et une même pièce principale revient au plus deux fois.
  const used = new Map<string, number>()
  const seen = new Set<string>()
  const picked: Idea[] = []
  for (const idea of all) {
    const core = idea.items.filter(isCore)
    const base = ideaKey(core.map((i) => i.id))
    if (seen.has(base) || core.some((i) => (used.get(i.id) ?? 0) >= 2)) continue
    seen.add(base)
    picked.push(idea)
    for (const i of core) used.set(i.id, (used.get(i.id) ?? 0) + 1)
    if (picked.length >= limit) break
  }
  return picked
}

function nameOf(base: Item[]) {
  return base.map((i) => i.name).join(' + ')
}
