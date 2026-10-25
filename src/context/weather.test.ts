import { describe, expect, it } from 'vitest'
import { summarize, weatherIcon } from './weather'

const hours = Array.from({ length: 48 }, (_, i) => {
  const d = i < 24 ? '2026-10-26' : '2026-10-27'
  return `${d}T${String(i % 24).padStart(2, '0')}:00`
})

describe('summarize', () => {
  it('ne garde que 8 h - 20 h du jour demandé', () => {
    const w = summarize(
      {
        hourly: {
          time: hours,
          apparent_temperature: hours.map((_, i) => (i < 24 ? i % 24 : 100)),
          precipitation_probability: hours.map((_, i) => (i === 14 ? 70 : i === 3 ? 100 : 0)),
          weather_code: hours.map((_, i) => (i === 14 ? 61 : 1)),
        },
      },
      '2026-10-26',
      'Lyon',
    )
    expect(w.minC).toBe(8)
    expect(w.maxC).toBe(20)
    expect(w.tempC).toBe(14)
    expect(w.rainProbability).toBe(70)
    expect(w.rain).toBe(true)
    expect(weatherIcon(w.code)).toBe('rain')
  })

  it('échoue proprement sans données pour le jour', () => {
    expect(() =>
      summarize({ hourly: { time: [], apparent_temperature: [], precipitation_probability: [], weather_code: [] } }, '2026-10-26', 'x'),
    ).toThrow()
  })
})
