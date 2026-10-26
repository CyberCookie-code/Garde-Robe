import { describe, expect, it } from 'vitest'
import { coverage, maskBounds, toAlpha, toInputTensor } from './cutout'

describe('détourage : calculs autour du modèle', () => {
  it('normalise l’image canal par canal, comme à l’entraînement', () => {
    const t = toInputTensor(new Uint8ClampedArray([255, 0, 128, 255, 0, 255, 128, 255]), 1)
    // 1 pixel de côté → 3 valeurs ; ici on ne lit que le premier pixel (size = 1).
    expect(t).toHaveLength(3)
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229)
    expect(t[1]).toBeCloseTo((0 - 0.456) / 0.224)
    expect(t[2]).toBeCloseTo((128 / 255 - 0.406) / 0.225)
  })

  it('étale la sortie du modèle sur 0-255', () => {
    expect([...toAlpha(new Float32Array([0.2, 0.6, 1]))]).toEqual([0, 128, 255])
    expect([...toAlpha(new Float32Array([0.5, 0.5]))]).toEqual([0, 0])
  })

  it('mesure la part de photo gardée', () => {
    expect(coverage(new Uint8ClampedArray([0, 127, 128, 255]))).toBe(0.5)
  })

  it('cadre le vêtement avec une petite marge', () => {
    const size = 10
    const alpha = new Uint8ClampedArray(size * size)
    for (let y = 2; y < 6; y++) for (let x = 3; x < 8; x++) alpha[y * size + x] = 255
    const b = maskBounds(alpha, size, 0.1)
    expect(b.x).toBeCloseTo(0.2)
    expect(b.y).toBeCloseTo(0.1)
    expect(b.w).toBeCloseTo(0.7)
    expect(b.h).toBeCloseTo(0.6)
  })

  it('reste dans la photo au bord et garde tout si le masque est vide', () => {
    const alpha = new Uint8ClampedArray(4).fill(255)
    expect(maskBounds(alpha, 2)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
    expect(maskBounds(new Uint8ClampedArray(4), 2)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})
