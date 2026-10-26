import { describe, expect, it } from 'vitest'
import { PALETTE } from '../domain/catalog'
import type { Item } from '../domain/types'
import { composeOutfits, ideaKey, isNeutral, missingForCompose } from './composer'
import type { MatchContext } from './engine'

const color = (name: string) => PALETTE.find((c) => c.name === name)!

const item = (id: string, p: Partial<Item> = {}): Item => ({
  id,
  ownerId: 'moi',
  name: id,
  category: 'haut',
  colors: [],
  pattern: 'uni',
  materials: [],
  seasons: [],
  warmth: 3,
  formality: 2,
  waterproof: false,
  tags: [],
  wearCount: 0,
  archived: false,
  createdAt: '2026-01-01',
  ...p,
})

const ctx = (items: Item[], p: Partial<MatchContext> = {}): MatchContext => ({
  date: '2026-10-26',
  season: 'automne',
  items: new Map(items.map((i) => [i.id, i])),
  recentWear: [],
  ...p,
})

const ids = (items: Item[]) => items.map((i) => i.id).sort()

describe('couleurs neutres', () => {
  it('compte marine, denim, kaki et camel comme neutres', () => {
    for (const n of ['Noir', 'Blanc', 'Beige', 'Marine', 'Denim', 'Kaki', 'Camel']) expect(isNeutral(color(n))).toBe(true)
  })
  it('garde rouge, vert, jaune et rose comme couleurs vives', () => {
    for (const n of ['Rouge', 'Vert', 'Jaune', 'Rose', 'Orange']) expect(isNeutral(color(n))).toBe(false)
  })
})

describe('composeur', () => {
  it('dit ce qu’il manque', () => {
    expect(missingForCompose([item('t')])).toMatch(/bas/)
    expect(missingForCompose([item('t'), item('j', { category: 'bas' })])).toBeNull()
    expect(missingForCompose([item('r', { category: 'robe' })])).toBeNull()
  })

  it('préfère une couleur vive sur des neutres à deux couleurs qui jurent', () => {
    const items = [
      item('pull-rouge', { colors: [color('Rouge')] }),
      item('jean', { category: 'bas', colors: [color('Denim')] }),
      item('pantalon-vert-pomme', { category: 'bas', colors: [{ name: 'Vert pomme', hex: '#8fd14f', family: 'vert' }] }),
    ]
    const [best] = composeOutfits(items, ctx(items))
    expect(ids(best.items)).toEqual(['jean', 'pull-rouge'])
    expect(best.reasons).toContain('touche de rouge sur des neutres')
  })

  it('évite deux motifs ensemble', () => {
    const items = [
      item('chemise-carreaux', { pattern: 'carreaux', colors: [color('Blanc')] }),
      item('pantalon-rayé', { category: 'bas', pattern: 'rayures', colors: [color('Noir')] }),
      item('pantalon-uni', { category: 'bas', colors: [color('Noir')] }),
    ]
    const [best, other] = composeOutfits(items, ctx(items))
    expect(ids(best.items)).toEqual(['chemise-carreaux', 'pantalon-uni'])
    expect(other.warnings).toContain('deux motifs qui se concurrencent')
  })

  it('ajoute un manteau quand il fait froid et l’enlève quand il fait chaud', () => {
    const items = [
      item('t-shirt', { warmth: 1, colors: [color('Blanc')] }),
      item('jean', { category: 'bas', colors: [color('Denim')] }),
      item('manteau', { category: 'manteau', warmth: 5, colors: [color('Camel')] }),
    ]
    const froid = composeOutfits(items, ctx(items, { weather: { tempC: 3, rain: false } }))
    expect(froid[0].items.map((i) => i.id)).toContain('manteau')
    const chaud = composeOutfits(items, ctx(items, { weather: { tempC: 27, rain: false } }))
    expect(chaud[0].items.map((i) => i.id)).not.toContain('manteau')
  })

  it('ne mélange pas costume et jogging', () => {
    const items = [
      item('chemise', { formality: 4, colors: [color('Blanc')] }),
      item('jogging', { category: 'bas', formality: 1, colors: [color('Gris')] }),
      item('pantalon-costume', { category: 'bas', formality: 4, colors: [color('Marine')] }),
    ]
    const [best] = composeOutfits(items, ctx(items, { occasion: 'travail' }))
    expect(ids(best.items)).toEqual(['chemise', 'pantalon-costume'])
  })

  it('ne repropose ni une tenue enregistrée ni une idée refusée', () => {
    const items = [item('a'), item('b'), item('x', { category: 'bas' })]
    const all = composeOutfits(items, ctx(items))
    expect(all).toHaveLength(2)
    const r = composeOutfits(items, ctx(items), { saved: [['a', 'x']], refused: [ideaKey(['x', 'b'])] })
    expect(r).toHaveLength(0)
  })

  it('ne repropose pas une association enregistrée avec d’autres chaussures', () => {
    const items = [item('a'), item('x', { category: 'bas' }), item('s1', { category: 'chaussures' }), item('s2', { category: 'chaussures' })]
    expect(composeOutfits(items, ctx(items))).toHaveLength(1)
    expect(composeOutfits(items, ctx(items), { saved: [['a', 'x', 's1']] })).toHaveLength(0)
  })

  it('évite les pièces portées ces derniers jours', () => {
    const items = [item('haut-1'), item('haut-2'), item('bas', { category: 'bas' })]
    const recentWear = [{ id: 'w', profileId: 'moi' as const, date: '2026-10-25', itemIds: ['haut-1'] }]
    const [best] = composeOutfits(items, ctx(items, { recentWear }))
    expect(ids(best.items)).toEqual(['bas', 'haut-2'])
  })

  it('varie les idées : une pièce principale revient au plus deux fois', () => {
    const items = [
      item('jean', { category: 'bas', colors: [color('Denim')] }),
      item('chino', { category: 'bas', colors: [color('Beige')] }),
      ...['Blanc', 'Noir', 'Gris', 'Marine'].map((c) => item(`t-${c}`, { colors: [color(c)] })),
    ]
    const r = composeOutfits(items, ctx(items))
    const count = (id: string) => r.filter((i) => i.items.some((x) => x.id === id)).length
    expect(count('jean')).toBeLessThanOrEqual(2)
    expect(r.length).toBe(4)
  })
})
