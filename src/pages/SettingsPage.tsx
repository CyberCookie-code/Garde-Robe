import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Id } from '../domain/types'
import { repo } from '../data/repo'
import {
  exportAll,
  exportWardrobe,
  importFile,
  lastBackup,
  requestPersistence,
  shareOrDownload,
} from '../data/backup'

export function SettingsPage({ profileId }: { profileId: Id }) {
  const profiles = useLiveQuery(() => repo.profiles.list())
  const backupAt = useLiveQuery(() => lastBackup.get())
  const [persisted, setPersisted] = useState<boolean>()
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)
  const me = profiles?.find((p) => p.id === profileId)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const run = (fn: () => Promise<string | void>) => async () => {
    setBusy(true)
    setMsg(undefined)
    try {
      const m = await fn()
      if (m) setMsg(m)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="form">
      <h2>Profils</h2>
      {profiles?.map((p) => (
        <label key={p.id}>
          Prénom ({p.id})
          <input defaultValue={p.name} onBlur={(e) => repo.profiles.update(p.id, { name: e.target.value.trim() || p.name })} />
        </label>
      ))}

      <h2>Sauvegarde</h2>
      <p className="muted">
        Tout reste sur ce téléphone. Fais une sauvegarde de temps en temps et range le fichier dans iCloud Drive ou
        Google Drive : c'est ce qui permet de tout récupérer en cas de changement ou de perte du téléphone.
      </p>
      <p>
        Dernière sauvegarde :{' '}
        <strong>{backupAt ? new Date(backupAt).toLocaleDateString('fr-FR', { dateStyle: 'medium' }) : 'jamais'}</strong>
      </p>
      <button
        className="primary"
        disabled={busy}
        onClick={run(async () => {
          const r = await shareOrDownload(await exportAll(), 'Sauvegarde garde-robe')
          if (r === 'annulé') return
          await lastBackup.mark()
          return r === 'téléchargé' ? 'Sauvegarde téléchargée.' : 'Sauvegarde prête.'
        })}
      >
        Sauvegarder tout
      </button>

      <h2>Partager avec l'autre téléphone</h2>
      <p className="muted">
        Envoie ta garde-robe (vêtements et tenues) à l'autre : elle apparaîtra dans ton profil sur son téléphone, pour
        assortir vos tenues. Pour une seule tenue, utilise « Partager » dans l'onglet Tenues.
      </p>
      <button
        disabled={busy}
        onClick={run(async () => {
          const r = await shareOrDownload(await exportWardrobe(profileId), `Garde-robe de ${me?.name ?? ''}`)
          if (r === 'téléchargé') return 'Fichier téléchargé : envoie-le à l’autre téléphone.'
        })}
      >
        Partager la garde-robe de {me?.name}
      </button>

      <label className="file-button">
        Importer un fichier (sauvegarde ou partage)
        <input
          type="file"
          accept=".json,application/json"
          hidden
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            void run(async () => {
              const r = await importFile(f)
              return `${r.kind === 'sauvegarde' ? 'Sauvegarde restaurée' : 'Partage importé'} : ${r.items} vêtement(s), ${r.outfits} tenue(s).`
            })()
          }}
        />
      </label>
      {msg && <p className="notice">{msg}</p>}

      <h2>Stockage</h2>
      <p>
        Protégé contre l'effacement automatique : <strong>{persisted === undefined ? '…' : persisted ? 'oui' : 'non'}</strong>
      </p>
      {persisted === false && (
        <>
          <p className="muted">
            Sur iPhone, ajoute l'app à l'écran d'accueil (Partager, « Sur l'écran d'accueil ») : Safari peut sinon effacer
            les données d'un site inutilisé pendant quelques semaines.
          </p>
          <button onClick={() => void requestPersistence().then(setPersisted)}>Demander la protection</button>
        </>
      )}
    </section>
  )
}
