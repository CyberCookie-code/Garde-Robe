import type { Material } from './types'

/**
 * Ce que chaque matière apporte au choix d'une tenue.
 * Les valeurs restent volontairement grossières : elles nuancent la chaleur
 * et le style déjà saisis, elles ne les remplacent pas.
 */
export interface MaterialTraits {
  label: string
  /** Agréable quand il fait chaud (respire, sèche vite). */
  breathable?: boolean
  /** Isole bien du froid. */
  insulating?: boolean
  /** Supporte mal la pluie (tache, gondole ou reste mouillé). */
  rainSensitive?: boolean
  /** Fait habillé (soirée, cérémonie). */
  dressy?: boolean
  /** Fait pour bouger et transpirer. */
  sporty?: boolean
  /** Trop chaud ou peu respirant au-dessus de 24 °C. */
  heavy?: boolean
}

export const MATERIALS: Record<Material, MaterialTraits> = {
  coton: { label: 'Coton', breathable: true },
  lin: { label: 'Lin', breathable: true },
  laine: { label: 'Laine', insulating: true, heavy: true, dressy: true },
  cachemire: { label: 'Cachemire', insulating: true, heavy: true, dressy: true, rainSensitive: true },
  soie: { label: 'Soie', dressy: true, rainSensitive: true },
  jean: { label: 'Jean', rainSensitive: true },
  cuir: { label: 'Cuir', heavy: true },
  daim: { label: 'Daim', rainSensitive: true, heavy: true },
  synthetique: { label: 'Synthétique', heavy: true },
  technique: { label: 'Technique', sporty: true, breathable: true },
  polaire: { label: 'Polaire', insulating: true, heavy: true, sporty: true },
  viscose: { label: 'Viscose', breathable: true },
}

export const MATERIAL_OPTIONS = (Object.keys(MATERIALS) as Material[]).map((value) => ({
  value,
  label: MATERIALS[value].label,
}))

export const hasTrait = (materials: Material[], trait: keyof Omit<MaterialTraits, 'label'>) =>
  materials.some((m) => MATERIALS[m]?.[trait])
