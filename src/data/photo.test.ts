import { describe, expect, it } from 'vitest'
import { PALETTE } from '../domain/catalog'
import { borderColor, rankPaletteColors } from './photo'

const fill = (hex: string, n: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return Array.from({ length: n }, () => [r, g, b, 255]).flat()
}

describe('rankPaletteColors', () => {
  it('reconnaît la couleur dominante', () => {
    const px = new Uint8ClampedArray([...fill('#2b3d5c', 70), ...fill('#ebe7e1', 30)])
    const r = rankPaletteColors(px, PALETTE)
    expect(r[0].color.name).toBe('Marine')
    expect(r[0].share).toBeCloseTo(0.7)
  })

  it('associe une teinte proche à la bonne pastille', () => {
    expect(rankPaletteColors(new Uint8ClampedArray(fill('#b08050', 10)), PALETTE)[0].color.name).toBe('Camel')
    expect(rankPaletteColors(new Uint8ClampedArray(fill('#c0392b', 10)), PALETTE)[0].color.name).toBe('Rouge')
  })

  it('ignore les pixels transparents', () => {
    const px = new Uint8ClampedArray([...fill('#c8302f', 5), 0, 0, 0, 0])
    expect(rankPaletteColors(px, PALETTE)).toHaveLength(1)
  })
  it('ignore le fond pour une petite pièce', () => {
    const bg: [number, number, number] = [235, 231, 225]
    const px = new Uint8ClampedArray([...fill('#ebe7e1', 80), ...fill('#6b4a32', 20)])
    expect(rankPaletteColors(px, PALETTE)[0].color.name).not.toBe('Marron')
    expect(rankPaletteColors(px, PALETTE, bg)[0].color.name).toBe('Marron')
  })

  it('garde tout si le vêtement a la couleur du fond', () => {
    const px = new Uint8ClampedArray(fill('#ebe7e1', 50))
    expect(rankPaletteColors(px, PALETTE, [235, 231, 225])).toHaveLength(1)
  })
})

describe('borderColor', () => {
  it('moyenne les pixels du bord', () => {
    const size = 6
    const px = new Uint8ClampedArray(size * size * 4)
    for (let i = 0; i < size * size; i++) px.set([10, 20, 30, 255], i * 4)
    expect(borderColor(px, size)).toEqual([10, 20, 30])
  })
})
