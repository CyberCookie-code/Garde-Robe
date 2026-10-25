import { describe, expect, it } from 'vitest'
import type { Item, Outfit } from '../domain/types'
import { rankOutfits, targetWarmth, type MatchContext } from './engine'

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

const outfit = (id: string, itemIds: string[], p: Partial<Outfit> = {}): Outfit => ({
  id,
  ownerId: 'moi',
  name: id,
  itemIds,
  seasons: [],
  occasions: [],
  moods: [],
  favorite: false,
  source: 'manuel',
  wearCount: 0,
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

describe('targetWarmth', () => {
  it('monte quand il fait froid', () => {
    expect(targetWarmth(0)).toBe(5)
    expect(targetWarmth(10)).toBe(4)
    expect(targetWarmth(15)).toBe(3)
    expect(targetWarmth(20)).toBe(2)
    expect(targetWarmth(28)).toBe(1)
  })
})

describe('météo', () => {
  const items = [
    item('t-shirt', { warmth: 1 }),
    item('doudoune', { warmth: 5, category: 'manteau' }),
    item('trench', { warmth: 3, category: 'manteau', waterproof: true }),
  ]
  const ete = outfit('été', ['t-shirt'])
  const hiver = outfit('hiver', ['t-shirt', 'doudoune'])
  const pluie = outfit('pluie', ['t-shirt', 'trench'])

  it('propose la tenue chaude par 2 °C', () => {
    const r = rankOutfits([ete, hiver], ctx(items, { weather: { tempC: 2, rain: false } }))
    expect(r[0].outfit.id).toBe('hiver')
    expect(r[1].reasons).toContain('trop légère pour aujourd’hui')
  })

  it('propose la tenue légère par 28 °C', () => {
    const r = rankOutfits([ete, hiver], ctx(items, { weather: { tempC: 28, rain: false } }))
    expect(r[0].outfit.id).toBe('été')
  })

  it('favorise une pièce imperméable quand il pleut', () => {
    const r = rankOutfits([ete, pluie], ctx(items, { weather: { tempC: 15, rain: true } }))
    expect(r[0].outfit.id).toBe('pluie')
    expect(r[0].reasons).toContain('prévue pour la pluie')
  })

  it('ne change rien sans météo', () => {
    const r = rankOutfits([ete], ctx(items))
    expect(r[0].reasons.some((x) => x.includes('°C'))).toBe(false)
  })
})

describe('événement', () => {
  const items = [
    item('jogging', { formality: 1 }),
    item('costume', { formality: 5 }),
    item('chemise', { formality: 3 }),
  ]

  it('respecte les occasions renseignées sur la tenue', () => {
    const sport = outfit('sport', ['jogging'], { occasions: ['sport'] })
    const bureau = outfit('bureau', ['chemise'], { occasions: ['travail'] })
    const r = rankOutfits([sport, bureau], ctx(items, { occasion: 'travail' }))
    expect(r[0].outfit.id).toBe('bureau')
    expect(r[0].reasons).toContain('pour le travail')
  })

  it("devine à partir du niveau d'habillé si la tenue n'a pas d'occasion", () => {
    const cool = outfit('cool', ['jogging'])
    const chic = outfit('chic', ['costume'])
    expect(rankOutfits([cool, chic], ctx(items, { occasion: 'ceremonie' }))[0].outfit.id).toBe('chic')
    expect(rankOutfits([cool, chic], ctx(items, { occasion: 'sport' }))[0].outfit.id).toBe('cool')
  })
})

describe('matières', () => {
  // Même chaleur et même style : seules les matières départagent.
  const items = [
    item('lin', { materials: ['lin'] }),
    item('laine', { materials: ['laine'] }),
    item('daim', { category: 'chaussures', materials: ['daim'] }),
    item('baskets', { category: 'chaussures', materials: ['synthetique'] }),
    item('jean', { category: 'bas', materials: ['jean'] }),
    item('legging', { category: 'bas', materials: ['technique'] }),
    item('sans', {}),
  ]

  it('préfère le lin quand il fait chaud et la laine quand il fait froid', () => {
    const lin = outfit('lin', ['lin'])
    const laine = outfit('laine', ['laine'])
    const chaud = rankOutfits([laine, lin], ctx(items, { weather: { tempC: 27, rain: false } }))
    expect(chaud[0].outfit.id).toBe('lin')
    expect(chaud[0].reasons).toContain('matières qui respirent')
    expect(chaud[1].reasons).toContain('matières chaudes pour la saison')
    const froid = rankOutfits([lin, laine], ctx(items, { weather: { tempC: 3, rain: false } }))
    expect(froid[0].outfit.id).toBe('laine')
  })

  it('évite le daim sous la pluie', () => {
    const r = rankOutfits(
      [outfit('daim', ['sans', 'daim']), outfit('baskets', ['sans', 'baskets'])],
      ctx(items, { weather: { tempC: 15, rain: true } }),
    )
    expect(r[0].outfit.id).toBe('baskets')
    expect(r[1].reasons).toContain('daim à éviter sous la pluie')
  })

  it('préfère les matières techniques pour le sport', () => {
    const r = rankOutfits([outfit('jean', ['jean']), outfit('legging', ['legging'])], ctx(items, { occasion: 'sport' }))
    expect(r[0].outfit.id).toBe('legging')
  })

  it('reste neutre sans matière, météo ni occasion', () => {
    expect(rankOutfits([outfit('sans', ['sans'])], ctx(items, { weather: { tempC: 30, rain: true } }))[0].reasons.join()).not.toContain('matière')
    expect(rankOutfits([outfit('lin', ['lin'])], ctx(items))[0].reasons).toHaveLength(0)
  })
})

describe('existant', () => {
  it('écarte une tenue dont une pièce a disparu', () => {
    const r = rankOutfits([outfit('x', ['absent'])], ctx([]))
    expect(r).toHaveLength(0)
  })

  it('évite une tenue portée il y a peu', () => {
    const items = [item('a'), item('b')]
    const r = rankOutfits(
      [outfit('hier', ['a']), outfit('autre', ['b'])],
      ctx(items, { recentWear: [{ id: 'w', profileId: 'moi', date: '2026-10-25', outfitId: 'hier', itemIds: ['a'] }] }),
    )
    expect(r[0].outfit.id).toBe('autre')
  })
})
