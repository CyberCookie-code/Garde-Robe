import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { repo } from '../data/repo'
import { SyncSection } from './SyncSection'

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

      <h2>Synchro entre nos téléphones</h2>
      <SyncSection />

      <h2>Stockage local</h2>
      <p>
        Stockage protégé : <strong>{persisted === undefined ? '…' : persisted ? 'oui' : 'non'}</strong>
      </p>
      {!persisted && (
        <button onClick={() => navigator.storage?.persist?.().then(setPersisted)}>Demander la protection</button>
      )}
    </section>
  )
}
