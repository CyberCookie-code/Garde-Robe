import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { locateMe, place, searchCity, type Place } from '../context/weather'

export function WeatherSettings() {
  const current = useLiveQuery(() => place.get())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>()
  const [msg, setMsg] = useState<string>()

  const choose = async (p: Place) => {
    await place.set(p)
    setResults(undefined)
    setQuery('')
    setMsg(undefined)
  }

  return (
    <>
      <p>
        Lieu : <strong>{current?.name ?? 'non défini'}</strong>
      </p>
      <button onClick={() => locateMe().then(choose, (e: Error) => setMsg(e.message))}>📍 Utiliser ma position</button>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim().length < 2) return
          searchCity(query.trim()).then(
            (r) => {
              setResults(r)
              setMsg(r.length ? undefined : 'Aucune ville trouvée.')
            },
            (e: Error) => setMsg(e.message),
          )
        }}
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="…ou une ville, ex. Lyon" />
        <button type="submit">Chercher</button>
      </form>
      {results?.map((r) => (
        <button key={`${r.latitude},${r.longitude}`} className="ghost result" onClick={() => void choose(r)}>
          {r.name}
        </button>
      ))}
      {msg && <p className="notice">{msg}</p>}
    </>
  )
}
