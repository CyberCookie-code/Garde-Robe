import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { locateMe, place, searchCity, type Place } from '../context/weather'
import { toast } from '../components/toast'
import { Icon } from '../components/icons'

export function WeatherSettings() {
  const current = useLiveQuery(() => place.get())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>()

  const choose = async (p: Place) => {
    await place.set(p)
    setResults(undefined)
    setQuery('')
    toast(`Météo : ${p.name}`)
  }

  return (
    <>
      <p className="status-line">
        <Icon name="pin" size={18} />
        <span>
          Lieu : <strong>{current?.name ?? 'non défini'}</strong>
        </span>
      </p>
      <button className="btn secondary wide" onClick={() => locateMe().then(choose, (e: Error) => toast(e.message))}>
        <Icon name="pin" /> Utiliser ma position
      </button>
      <form
        className="inline-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim().length < 2) return
          searchCity(query.trim()).then(
            (r) => {
              setResults(r)
              if (!r.length) toast('Aucune ville trouvée.')
            },
            (e: Error) => toast(e.message),
          )
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="…ou une ville, ex. Lyon"
          aria-label="Ville pour la météo"
          enterKeyHint="search"
        />
        <button className="btn secondary" type="submit">
          Chercher
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button className="result" onClick={() => void choose(r)}>
                {r.name}
                <Icon name="chevron" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
