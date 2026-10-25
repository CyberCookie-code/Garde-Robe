import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { CATEGORIES, OCCASIONS } from '../domain/catalog'
import type { Id, Item, Occasion } from '../domain/types'
import { repo, today } from '../data/repo'
import { exportAll, lastBackup, shareOrDownload } from '../data/backup'
import { rankOutfits, seasonOf } from '../matching/engine'
import { Chips, Empty, ItemThumb } from '../components/ui'
import { locateMe, place, todayWeather, weatherIcon, type DayWeather } from '../context/weather'

const occasionKey = (date: string) => `occasion:${date}`
const readOccasion = (date: string) => {
  try {
    return (localStorage.getItem(occasionKey(date)) as Occasion | null) ?? undefined
  } catch {
    return undefined
  }
}

const catOrder = (i: Item) => CATEGORIES.findIndex((c) => c.value === i.category)

export function TodayPage({ profileId }: { profileId: Id }) {
  const date = today()
  const data = useLiveQuery(async () => {
    const [outfits, items, recentWear, worn, backupAt] = await Promise.all([
      repo.outfits.listByOwner(profileId),
      repo.items.listByOwner(profileId),
      repo.wear.recent(profileId),
      repo.wear.forDay(profileId, date),
      lastBackup.get(),
    ])
    return { outfits, items, recentWear, worn, backupAt }
  }, [profileId, date])
  const [skip, setSkip] = useState(0)
  const [occasion, setOccasionState] = useState<Occasion | undefined>(() => readOccasion(date))
  const [weather, setWeather] = useState<DayWeather | 'aucune' | 'erreur'>()
  const [weatherTick, setWeatherTick] = useState(0)

  useEffect(() => {
    let alive = true
    todayWeather(date)
      .then((w) => alive && setWeather(w ?? 'aucune'))
      .catch(() => alive && setWeather('erreur'))
    return () => {
      alive = false
    }
  }, [date, weatherTick])

  const setOccasion = (o: Occasion | undefined) => {
    setOccasionState(o)
    setSkip(0)
    try {
      if (o) localStorage.setItem(occasionKey(date), o)
      else localStorage.removeItem(occasionKey(date))
    } catch {
      /* navigation privée */
    }
  }

  const enableWeather = async () => {
    try {
      await place.set(await locateMe())
      setWeatherTick((t) => t + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  if (!data) return null
  const items = new Map(data.items.map((i) => [i.id, i]))
  // On exclut la tenue déjà portée aujourd'hui du calcul de récence pour qu'elle reste affichée.
  const recentWear = data.recentWear.filter((w) => w.date !== date)
  const ranked = rankOutfits(data.outfits, {
    date,
    season: seasonOf(new Date()),
    items,
    recentWear,
    occasion,
    weather: typeof weather === 'object' ? weather : undefined,
  })

  if (ranked.length === 0)
    return <Empty>Pas encore de tenue enregistrée. Ajoute des vêtements puis compose une tenue dans l'onglet Tenues.</Empty>

  const wornOutfit = data.worn && data.outfits.find((o) => o.id === data.worn!.outfitId)
  const current = wornOutfit ? { outfit: wornOutfit, reasons: ['portée aujourd’hui'] } : ranked[skip % ranked.length]

  const backupDays = data.backupAt ? (Date.parse(date) - Date.parse(data.backupAt.slice(0, 10))) / 86_400_000 : Infinity
  const backupReminder = data.items.length >= 5 && backupDays > 14

  return (
    <section className="today">
      {backupReminder && (
        <div className="banner">
          <span>{data.backupAt ? 'Dernière sauvegarde il y a plus de 2 semaines.' : 'Aucune sauvegarde pour l’instant.'}</span>
          <button
            onClick={async () => {
              if ((await shareOrDownload(await exportAll(), 'Sauvegarde garde-robe')) !== 'annulé') await lastBackup.mark()
            }}
          >
            Sauvegarder
          </button>
        </div>
      )}
      <p className="muted">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <div className="day-context">
        {typeof weather === 'object' ? (
          <p className="weather">
            {weatherIcon(weather.code)} <strong>{Math.round(weather.tempC)}°C</strong> ressentis
            <span className="muted">
              {' '}
              ({Math.round(weather.minC)}° à {Math.round(weather.maxC)}°)
              {weather.rain ? ` · pluie probable (${weather.rainProbability} %)` : ''}
            </span>
          </p>
        ) : weather === 'aucune' ? (
          <button className="ghost small" onClick={() => void enableWeather()}>
            📍 Tenir compte de la météo
          </button>
        ) : weather === 'erreur' ? (
          <p className="muted small">Météo indisponible (hors-ligne ?)</p>
        ) : null}
        {!wornOutfit && (
          <Chips
            options={OCCASIONS}
            value={occasion ? [occasion] : []}
            onChange={(v) => setOccasion(v.find((x) => x !== occasion))}
          />
        )}
      </div>
      <h2>{current.outfit.name}</h2>
      {current.reasons.length > 0 && <p className="reasons">{current.reasons.join(' · ')}</p>}
      <div className="today-items">
        {current.outfit.itemIds
          .map((id) => items.get(id))
          .filter((it): it is Item => !!it)
          .sort((a, b) => catOrder(a) - catOrder(b))
          .map((it) => (
            <figure key={it.id}>
              <ItemThumb item={it} />
              <figcaption>{it.name}</figcaption>
            </figure>
          ))}
      </div>
      {wornOutfit ? (
        <p className="done">✓ C'est noté pour aujourd'hui.</p>
      ) : (
        <div className="actions">
          <button className="primary" onClick={() => repo.wear.log(profileId, current.outfit)}>
            Je la porte
          </button>
          <button onClick={() => setSkip((s) => s + 1)} disabled={ranked.length < 2}>
            Autre idée ({(skip % ranked.length) + 1}/{ranked.length})
          </button>
        </div>
      )}
    </section>
  )
}
