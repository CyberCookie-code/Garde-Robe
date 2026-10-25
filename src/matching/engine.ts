import type { Item, Mood, Occasion, Outfit, Season, WearLog } from '../domain/types'

/**
 * Moteur de suggestion de la « tenue du jour ».
 * Chaque critère est une petite fonction indépendante qui note une tenue.
 * Ajouter un critère (météo, événement, couleurs, colorimétrie, mood, IA)
 * = ajouter une fonction à CRITERIA, sans toucher au reste.
 */
export interface MatchContext {
  date: string
  season: Season
  items: Map<string, Item>
  recentWear: WearLog[]
  weather?: { tempC: number; rain: boolean } // étape 2
  occasion?: Occasion // étape 3
  mood?: Mood // étape 3
}

export interface CriterionResult {
  score: number // négatif = pénalité, positif = bonus
  reason?: string
  exclude?: boolean
}

export type Criterion = (outfit: Outfit, ctx: MatchContext) => CriterionResult

export function seasonOf(date: Date): Season {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'printemps'
  if (m >= 6 && m <= 8) return 'ete'
  if (m >= 9 && m <= 11) return 'automne'
  return 'hiver'
}

const bySeason: Criterion = (o, ctx) => {
  if (o.seasons.length === 0) return { score: 0 }
  return o.seasons.includes(ctx.season)
    ? { score: 3, reason: 'de saison' }
    : { score: -5, reason: 'hors saison' }
}

const byRecency: Criterion = (o, ctx) => {
  const idx = ctx.recentWear.findIndex((w) => w.outfitId === o.id)
  if (idx === -1) return { score: 2, reason: 'pas portée récemment' }
  if (idx < 3) return { score: -6, reason: 'portée il y a peu' }
  return { score: -1 }
}

const byFavorite: Criterion = (o) => (o.favorite ? { score: 1, reason: 'favorite' } : { score: 0 })

/** Actif seulement quand la météo est fournie (étape 2). */
const byWeather: Criterion = (o, ctx) => {
  if (!ctx.weather) return { score: 0 }
  const items = o.itemIds.map((id) => ctx.items.get(id)).filter((i): i is Item => !!i)
  if (items.length === 0) return { score: 0 }
  const warmth = Math.max(...items.map((i) => i.warmth))
  const t = ctx.weather.tempC
  const target = t < 5 ? 5 : t < 12 ? 4 : t < 18 ? 3 : t < 24 ? 2 : 1
  const diff = Math.abs(warmth - target)
  let score = 3 - diff * 2
  let reason = diff === 0 ? `adaptée à ${Math.round(t)}°C` : undefined
  if (ctx.weather.rain && items.some((i) => i.waterproof)) {
    score += 2
    reason = 'prévue pour la pluie'
  }
  return { score, reason }
}

/** Une tenue dont un vêtement a été supprimé n'est plus proposée. */
const byAvailability: Criterion = (o, ctx) =>
  o.itemIds.every((id) => ctx.items.has(id)) ? { score: 0 } : { score: 0, exclude: true }

export const CRITERIA: Criterion[] = [byAvailability, bySeason, byRecency, byFavorite, byWeather]

export interface Suggestion {
  outfit: Outfit
  score: number
  reasons: string[]
}

/** Petit hash stable pour départager les ex æquo différemment chaque jour. */
function dayHash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 2 ** 32
}

export function rankOutfits(outfits: Outfit[], ctx: MatchContext, criteria = CRITERIA): Suggestion[] {
  return outfits
    .map((outfit) => {
      const results = criteria.map((c) => c(outfit, ctx))
      if (results.some((r) => r.exclude)) return null
      return {
        outfit,
        score: results.reduce((s, r) => s + r.score, 0) + dayHash(ctx.date + outfit.id),
        reasons: results.map((r) => r.reason).filter((r): r is string => !!r),
      }
    })
    .filter((s): s is Suggestion => !!s)
    .sort((a, b) => b.score - a.score)
}
