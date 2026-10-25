// Modèle de données. Les champs marqués « futur » ne sont pas encore utilisés par l'UI,
// mais sont là pour que le matching avancé (météo, événement, mood, colorimétrie, IA)
// n'oblige pas à migrer toutes les données plus tard.

export type Id = string

export type Category =
  | 'haut'
  | 'bas'
  | 'robe'
  | 'veste'
  | 'manteau'
  | 'chaussures'
  | 'accessoire'

export type Season = 'printemps' | 'ete' | 'automne' | 'hiver'

/** Familles de couleurs utilisées par les règles d'harmonie. */
export type ColorFamily =
  | 'neutre'
  | 'rouge'
  | 'orange'
  | 'jaune'
  | 'vert'
  | 'bleu'
  | 'violet'
  | 'rose'
  | 'marron'

export interface ColorTag {
  name: string
  hex: string
  family: ColorFamily
}

export type Pattern = 'uni' | 'rayures' | 'carreaux' | 'imprime' | 'fleuri' | 'autre'

/** Occasions / événements (futur : filtre « événement »). */
export type Occasion = 'quotidien' | 'travail' | 'sport' | 'soiree' | 'ceremonie' | 'week-end'

/** Mood du jour (futur). */
export type Mood = 'confort' | 'chic' | 'audacieux' | 'discret' | 'energique'

/** Saison colorimétrique de la personne (futur, saisie manuelle). */
export type ColorSeason = 'printemps' | 'ete' | 'automne' | 'hiver'
export type Undertone = 'chaud' | 'froid' | 'neutre'

/** Champs communs : `updatedAt` sert à la synchro. */
interface Synced {
  updatedAt?: string
}

export interface Profile extends Synced {
  id: Id
  name: string
  accent: string
  /** futur : colorimétrie déclarée, jamais déduite d'une photo du visage côté serveur */
  colorSeason?: ColorSeason
  undertone?: Undertone
  /** futur : couleurs à éviter / préférées */
  favoriteColors?: string[]
  avoidColors?: string[]
}

export interface Item extends Synced {
  id: Id
  ownerId: Id
  photo?: Blob
  /** chemin de la photo dans Supabase Storage, une fois envoyée */
  photoPath?: string
  name: string
  category: Category
  colors: ColorTag[]
  pattern: Pattern
  seasons: Season[]
  /** 1 = très léger, 5 = très chaud. Sert au filtre météo. */
  warmth: 1 | 2 | 3 | 4 | 5
  /** 1 = très décontracté, 5 = très habillé. Sert au filtre événement. */
  formality: 1 | 2 | 3 | 4 | 5
  waterproof: boolean
  tags: string[]
  wearCount: number
  lastWornAt?: string
  archived: boolean
  createdAt: string
}

export type OutfitSource = 'manuel' | 'regles' | 'ia'

export interface Outfit extends Synced {
  id: Id
  ownerId: Id
  name: string
  itemIds: Id[]
  seasons: Season[]
  occasions: Occasion[]
  moods: Mood[]
  /** futur : plage de température conseillée, en °C */
  minTemp?: number
  maxTemp?: number
  favorite: boolean
  source: OutfitSource
  wearCount: number
  lastWornAt?: string
  createdAt: string
}

/** Historique : ce qui a été porté un jour donné (sert à éviter les répétitions et, plus tard, à l'IA). */
export interface WearLog extends Synced {
  id: Id
  profileId: Id
  date: string // AAAA-MM-JJ
  outfitId?: Id
  itemIds: Id[]
  mood?: Mood
  occasion?: Occasion
  weather?: { tempC: number; rain: boolean; code?: number }
  rating?: 1 | 2 | 3 | 4 | 5
}

/** futur : deux tenues (une par profil) assorties pour une même sortie. */
export interface CoupleLook extends Synced {
  id: Id
  name: string
  outfitIds: [Id, Id]
  occasion?: Occasion
  createdAt: string
}
