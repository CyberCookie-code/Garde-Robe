import type { Category, ColorTag, Occasion, Mood, Pattern, Season } from './types'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'haut', label: 'Haut' },
  { value: 'bas', label: 'Bas' },
  { value: 'robe', label: 'Robe / combi' },
  { value: 'veste', label: 'Veste / pull' },
  { value: 'manteau', label: 'Manteau' },
  { value: 'chaussures', label: 'Chaussures' },
  { value: 'accessoire', label: 'Accessoire' },
]

export const SEASONS: { value: Season; label: string }[] = [
  { value: 'printemps', label: 'Printemps' },
  { value: 'ete', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'hiver', label: 'Hiver' },
]

export const PATTERNS: { value: Pattern; label: string }[] = [
  { value: 'uni', label: 'Uni' },
  { value: 'rayures', label: 'Rayures' },
  { value: 'carreaux', label: 'Carreaux' },
  { value: 'imprime', label: 'Imprimé' },
  { value: 'fleuri', label: 'Fleuri' },
  { value: 'autre', label: 'Autre' },
]

export const OCCASIONS: { value: Occasion; label: string }[] = [
  { value: 'quotidien', label: 'Quotidien' },
  { value: 'travail', label: 'Travail' },
  { value: 'week-end', label: 'Week-end' },
  { value: 'sport', label: 'Sport' },
  { value: 'soiree', label: 'Soirée' },
  { value: 'ceremonie', label: 'Cérémonie' },
]

export const MOODS: { value: Mood; label: string }[] = [
  { value: 'confort', label: 'Confort' },
  { value: 'chic', label: 'Chic' },
  { value: 'audacieux', label: 'Audacieux' },
  { value: 'discret', label: 'Discret' },
  { value: 'energique', label: 'Énergique' },
]

/** Palette de départ : choisir une pastille est plus rapide et plus fiable qu'un sélecteur libre. */
export const PALETTE: ColorTag[] = [
  { name: 'Noir', hex: '#1c1c1c', family: 'neutre' },
  { name: 'Blanc', hex: '#f7f7f5', family: 'neutre' },
  { name: 'Gris', hex: '#8e8e8e', family: 'neutre' },
  { name: 'Beige', hex: '#d9c7a7', family: 'neutre' },
  { name: 'Marine', hex: '#1f2f56', family: 'bleu' },
  { name: 'Bleu', hex: '#3a6fd8', family: 'bleu' },
  { name: 'Ciel', hex: '#9cc6ec', family: 'bleu' },
  { name: 'Denim', hex: '#4b6a8f', family: 'bleu' },
  { name: 'Vert', hex: '#3f8f4f', family: 'vert' },
  { name: 'Kaki', hex: '#76704a', family: 'vert' },
  { name: 'Rouge', hex: '#c8302f', family: 'rouge' },
  { name: 'Bordeaux', hex: '#6d1f2e', family: 'rouge' },
  { name: 'Rose', hex: '#e79bb4', family: 'rose' },
  { name: 'Orange', hex: '#e07a2e', family: 'orange' },
  { name: 'Jaune', hex: '#e8c547', family: 'jaune' },
  { name: 'Violet', hex: '#6f4c9b', family: 'violet' },
  { name: 'Marron', hex: '#6b4a32', family: 'marron' },
  { name: 'Camel', hex: '#b5824f', family: 'marron' },
]

export const labelOf = <T extends string>(list: { value: T; label: string }[], v: T) =>
  list.find((x) => x.value === v)?.label ?? v
