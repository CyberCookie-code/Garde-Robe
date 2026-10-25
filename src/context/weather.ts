import { meta } from '../data/db'

/**
 * Météo du jour via Open-Meteo (gratuit, sans clé, sans compte).
 * La position est demandée une fois puis mémorisée : sur iPhone, une app installée
 * redemanderait sinon l'autorisation à chaque ouverture.
 */

export interface Place {
  name: string
  latitude: number
  longitude: number
}

export interface DayWeather {
  date: string
  /** température ressentie moyenne entre 8 h et 20 h */
  tempC: number
  minC: number
  maxC: number
  rain: boolean
  rainProbability: number
  code: number
  place: string
}

const PLACE_KEY = 'weatherPlace'
const CACHE_KEY = 'weatherCache'
const CACHE_MS = 3 * 3600_000

export const place = {
  get: async (): Promise<Place | undefined> => {
    const v = await meta.get(PLACE_KEY)
    return v ? JSON.parse(v) : undefined
  },
  set: (p: Place) => meta.set(PLACE_KEY, JSON.stringify(p)),
}

export function locateMe(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Localisation indisponible sur cet appareil.'))
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          name: 'Ma position',
          // arrondi à ~1 km : suffisant pour la météo, et moins précis à garder en mémoire
          latitude: Math.round(pos.coords.latitude * 100) / 100,
          longitude: Math.round(pos.coords.longitude * 100) / 100,
        }),
      () => reject(new Error('Localisation refusée. Tu peux indiquer ta ville à la place.')),
      { maximumAge: 3600_000, timeout: 10_000 },
    )
  })
}

export async function searchCity(query: string): Promise<Place[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=5&language=fr&name=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Recherche de ville impossible.')
  const data = (await res.json()) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[]
  }
  return (data.results ?? []).map((r) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}

interface ForecastResponse {
  hourly: {
    time: string[]
    apparent_temperature: number[]
    precipitation_probability: (number | null)[]
    weather_code: number[]
  }
}

/** Résume les prévisions horaires d'une journée (fonction pure, testée). */
export function summarize(data: ForecastResponse, date: string, placeName: string): DayWeather {
  const { time, apparent_temperature, precipitation_probability, weather_code } = data.hourly
  const idx = time
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.startsWith(date))
    .filter(({ t }) => {
      const h = Number(t.slice(11, 13))
      return h >= 8 && h <= 20
    })
    .map(({ i }) => i)
  if (idx.length === 0) throw new Error('Pas de prévision pour aujourd’hui.')
  const temps = idx.map((i) => apparent_temperature[i])
  const rainProbability = Math.max(...idx.map((i) => precipitation_probability[i] ?? 0))
  // code le plus « fort » de la journée (la pluie l'emporte sur les nuages)
  const code = Math.max(...idx.map((i) => weather_code[i]))
  return {
    date,
    tempC: temps.reduce((a, b) => a + b, 0) / temps.length,
    minC: Math.min(...temps),
    maxC: Math.max(...temps),
    rainProbability,
    rain: rainProbability >= 50,
    code,
    place: placeName,
  }
}

export async function todayWeather(date: string): Promise<DayWeather | undefined> {
  const p = await place.get()
  if (!p) return undefined
  const cached = await meta.get(CACHE_KEY)
  if (cached) {
    const c = JSON.parse(cached) as DayWeather & { at: number; lat: number; lon: number }
    if (c.date === date && c.lat === p.latitude && c.lon === p.longitude && Date.now() - c.at < CACHE_MS) return c
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
    '&hourly=apparent_temperature,precipitation_probability,weather_code&forecast_days=2&timezone=auto'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Météo indisponible.')
  const w = summarize((await res.json()) as ForecastResponse, date, p.name)
  await meta.set(CACHE_KEY, JSON.stringify({ ...w, at: Date.now(), lat: p.latitude, lon: p.longitude }))
  return w
}

/** Codes WMO utilisés par Open-Meteo. */
export function weatherIcon(code: number) {
  if (code >= 95) return '⛈️'
  if (code >= 71 && code <= 86 && !(code >= 80 && code <= 82)) return '❄️'
  if (code >= 51) return '🌧️'
  if (code >= 45) return '🌫️'
  if (code >= 2) return '☁️'
  if (code === 1) return '🌤️'
  return '☀️'
}
