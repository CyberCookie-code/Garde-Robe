import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { repo } from '../data/repo'

export function SettingsPage() {
  const profiles = useLiveQuery(() => repo.profiles.list())
  const [persisted, setPersisted] = useState<boolean>()

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  return (
    <section className="form">
      <h2>Profils</h2>
      {profiles?.map((p) => (
        <label key={p.id}>
          Prénom ({p.id})
          <input defaultValue={p.name} onBlur={(e) => repo.profiles.update(p.id, { name: e.target.value.trim() || p.name })} />
        </label>
      ))}

      <h2>Stockage</h2>
      <p className="muted">
        Pour l'instant les données restent sur ce téléphone uniquement. La synchronisation entre vos deux téléphones
        est la prochaine étape.
      </p>
      <p>
        Stockage protégé : <strong>{persisted === undefined ? '…' : persisted ? 'oui' : 'non'}</strong>
      </p>
      {!persisted && (
        <button onClick={() => navigator.storage?.persist?.().then(setPersisted)}>Demander la protection</button>
      )}
    </section>
  )
}
