import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { CATEGORIES, OCCASIONS } from '../domain/catalog'
import type { Item, Occasion } from '../domain/types'
import { repo, today } from '../data/repo'
import { exportAll, lastBackup, shareOrDownload } from '../data/backup'
import { rankOutfits, seasonOf } from '../matching/engine'
import { Chips, Collage, EmptyState, ItemThumb, PageHeader, Segmented } from '../components/ui'
import { toast } from '../components/toast'
import { Icon } from '../components/icons'
import { locateMe, place, todayWeather, weatherIcon, type DayWeather } from '../context/weather'
import type { Go } from '../App'
import { IdeasView } from './IdeasView'

type Mode = 'saved' | 'ideas'
const MODES: { value: Mode; label: string }[] = [
  { value: 'saved', label: 'Mes tenues' },
  { value: 'ideas', label: 'Idées de l’app' },
]

const catOrder = (i: Item) => CATEGORIES.findIndex((c) => c.value === i.category)

const occasionKey = (date: string) => `occasion:${date}`
const readOccasion = (date: string) => {
  try {
    return (localStorage.getItem(occasionKey(date)) as Occasion | null) ?? undefined
  } catch {
    return undefined
  }
}

export function TodayPage({ go }: { go: Go }) {
  const date = today()
  const data = useLiveQuery(async () => {
    const [outfits, items, recentWear, worn, backupAt] = await Promise.all([
      repo.outfits.list(),
      repo.items.list(),
      repo.wear.recent(),
      repo.wear.forDay(date),
      lastBackup.get(),
    ])
    return { outfits, items, recentWear, worn, backupAt }
  }, [date])
  const [skip, setSkip] = useState(0)
  const [mode, setMode] = useState<Mode>()
  const [occasion, setOccasionState] = useState<Occasion | undefined>(() => readOccasion(date))
  const [weather, setWeather] = useState<DayWeather | 'aucune' | 'erreur'>()
  const [weatherTick, setWeatherTick] = useState(0)
  const [locating, setLocating] = useState(false)

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
    setLocating(true)
    try {
      await place.set(await locateMe())
      setWeatherTick((t) => t + 1)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e))
    } finally {
      setLocating(false)
    }
  }

  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const header = <PageHeader eyebrow={dateLabel} title="Aujourd’hui" />

  if (!data) return header

  if (data.items.length === 0)
    return (
      <>
        {header}
        <EmptyState
          icon="hanger"
          title="Ta garde-robe est vide"
          action={
            <button className="btn primary" onClick={() => go('wardrobe', 'add-item')}>
              <Icon name="camera" /> Photographier un vêtement
            </button>
          }
        >
          Commence par tes pièces préférées : une photo, une catégorie, c’est tout.
        </EmptyState>
      </>
    )

  const items = new Map(data.items.map((i) => [i.id, i]))
  // La tenue déjà portée aujourd'hui ne compte pas dans la récence, pour qu'elle reste affichée.
  const recentWear = data.recentWear.filter((w) => w.date !== date)
  const ctx = {
    date,
    season: seasonOf(new Date()),
    items,
    recentWear,
    occasion,
    weather: typeof weather === 'object' ? weather : undefined,
  }
  const ranked = rankOutfits(data.outfits, ctx)

  const wornOutfit = data.worn && data.outfits.find((o) => o.id === data.worn!.outfitId)
  // Sans tenue enregistrée, on commence par les idées composées par l'app.
  const shown: Mode = wornOutfit ? 'saved' : (mode ?? (ranked.length ? 'saved' : 'ideas'))
  const current = wornOutfit
    ? { outfit: wornOutfit, reasons: [] as string[] }
    : ranked.length
      ? ranked[skip % ranked.length]
      : undefined
  const pieces = (current?.outfit.itemIds ?? [])
    .map((id) => items.get(id))
    .filter((it): it is Item => !!it)
    .sort((a, b) => catOrder(a) - catOrder(b))

  const backupDays = data.backupAt ? (Date.parse(date) - Date.parse(data.backupAt.slice(0, 10))) / 86_400_000 : Infinity
  const backupReminder = data.items.length >= 5 && backupDays > 14

  return (
    <>
      {header}
      <section className="today">
        <div className="weather-hero">
          {typeof weather === 'object' ? (
            <>
              <p className="temp">
                <strong>{Math.round(weather.tempC)}°</strong>
                <span>
                  ressentis
                  {weather.place && weather.place !== 'Ma position' && <span className="muted"> · {weather.place}</span>}
                  {weather.rain && <span className="rain">Pluie {weather.rainProbability} %</span>}
                </span>
              </p>
              <span className="round-icon" aria-hidden="true">
                <Icon name={weatherIcon(weather.code)} size={24} />
              </span>
            </>
          ) : weather === 'aucune' ? (
            <button className="weather-add" onClick={() => void enableWeather()} disabled={locating}>
              <span className="round-icon">
                <Icon name="pin" size={20} />
              </span>
              <span>
                <strong>{locating ? 'Localisation…' : 'Ajouter la météo'}</strong>
                <span className="muted">pour adapter la tenue au temps qu’il fait</span>
              </span>
            </button>
          ) : weather === 'erreur' ? (
            <p className="muted">Météo indisponible</p>
          ) : (
            <p className="temp skeleton" aria-hidden="true" />
          )}
        </div>

        {!wornOutfit && <Segmented label="Source des tenues" options={MODES} value={shown} onChange={setMode} />}

        {!wornOutfit && (
          <Chips
            label="Occasion du jour"
            scroll
            options={OCCASIONS}
            value={occasion ? [occasion] : []}
            onChange={(v) => setOccasion(v.find((x) => x !== occasion))}
          />
        )}

        {shown === 'ideas' ? (
          <IdeasView items={data.items} ctx={ctx} saved={data.outfits.map((o) => o.itemIds)} go={go} stay={() => setMode('ideas')} />
        ) : !current ? (
          <EmptyState
            icon="layers"
            title="Aucune tenue enregistrée"
            action={
              <>
                <button className="btn primary" onClick={() => setMode('ideas')}>
                  <Icon name="sparkle" /> Voir les idées de l’app
                </button>
                <button className="btn secondary" onClick={() => go('outfits', 'new-outfit')}>
                  <Icon name="plus" /> Composer moi-même
                </button>
              </>
            }
          >
            Enregistre les idées qui te plaisent ou compose tes propres tenues : ce sont elles qui te seront proposées ici.
          </EmptyState>
        ) : (
          <>
            <article className={`outfit-hero ${wornOutfit ? 'worn' : ''}`} aria-live="polite">
              <div className="hero-media">
                <Collage items={pieces} className="hero-collage" />
                <div className="hero-overlay">
                  {wornOutfit ? (
                    <p className="glass badge">
                      <Icon name="check" size={16} /> Portée aujourd’hui
                    </p>
                  ) : (
                    ranked.length > 1 && (
                      <p className="glass">
                        Idée {(skip % ranked.length) + 1} sur {ranked.length}
                      </p>
                    )
                  )}
                  <h2>{current.outfit.name}</h2>
                  {current.reasons.length > 0 && (
                    <ul className="reasons" aria-label="Pourquoi cette tenue">
                      {current.reasons.map((r) => (
                        <li key={r} className="glass">
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {wornOutfit ? (
                <div className="hero-bar">
                  <button
                    className="btn ghost wide"
                    onClick={async () => {
                      await repo.wear.undo()
                      toast('C’est annulé.')
                    }}
                  >
                    <Icon name="undo" /> Changer de tenue
                  </button>
                </div>
              ) : (
                <div className="hero-bar actions">
                  <button
                    className="btn dark"
                    onClick={() => setSkip((s) => s + 1)}
                    disabled={ranked.length < 2}
                    aria-label={`Autre idée, ${(skip % ranked.length) + 1} sur ${ranked.length}`}
                  >
                    <Icon name="refresh" /> Autre idée
                  </button>
                  <button
                    className="btn primary"
                    onClick={async () => {
                      await repo.wear.log(current.outfit, { occasion })
                      toast('Bonne journée !')
                    }}
                  >
                    <Icon name="check" /> Je la porte
                  </button>
                </div>
              )}
            </article>

            <section aria-labelledby="pieces-title">
              <h3 className="section-title" id="pieces-title">
                Dans cette tenue
              </h3>
              <ul className="pieces">
                {pieces.map((p) => (
                  <li key={p.id}>
                    <ItemThumb item={p} />
                    <span>{p.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {backupReminder && (
          <div className="banner">
            <Icon name="shield" />
            <p>{data.backupAt ? 'Dernière sauvegarde il y a plus de 2 semaines.' : 'Tes vêtements ne sont pas encore sauvegardés.'}</p>
            <button
              className="btn small secondary"
              onClick={async () => {
                const r = await shareOrDownload(await exportAll(), 'Sauvegarde garde-robe')
                if (r !== 'annulé') {
                  await lastBackup.mark()
                  toast('Sauvegarde prête.')
                }
              }}
            >
              Sauvegarder
            </button>
          </div>
        )}
      </section>
    </>
  )
}
