import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { exportAll, exportWardrobe, importFile, lastBackup, requestPersistence, shareOrDownload } from '../data/backup'
import { PageHeader } from '../components/ui'
import { toast } from '../components/toast'
import { Icon } from '../components/icons'
import { WeatherSettings } from './WeatherSettings'
import { prefs } from '../data/prefs'

export function SettingsPage() {
  const backupAt = useLiveQuery(() => lastBackup.get())
  const [persisted, setPersisted] = useState<boolean>()
  const [busy, setBusy] = useState(false)
  const [autoCutout, setAutoCutout] = useState(prefs.autoCutout.get)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const run = (fn: () => Promise<string | void>) => async () => {
    setBusy(true)
    try {
      const m = await fn()
      if (m) toast(m)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Réglages" />
      <div className="settings">
        <section className="card" aria-labelledby="s-meteo">
          <h2 id="s-meteo">Météo</h2>
          <WeatherSettings />
        </section>

        <section className="card" aria-labelledby="s-photos">
          <h2 id="s-photos">Photos</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={autoCutout}
              onChange={(e) => {
                prefs.autoCutout.set(e.target.checked)
                setAutoCutout(e.target.checked)
              }}
            />
            <span>Retirer le fond automatiquement</span>
          </label>
          <p className="muted">
            Le fond est retiré sur le téléphone, la photo n’est envoyée nulle part. Le premier détourage télécharge l’outil
            une seule fois (jusqu’à 19 Mo), ensuite il marche hors ligne. Ça marche bien sur un fond simple ; avec une personne
            ou plusieurs objets sur la photo, le résultat peut être raté : tu peux toujours remettre le fond.
          </p>
        </section>

        <section className="card" aria-labelledby="s-save">
          <h2 id="s-save">Sauvegarde</h2>
          <p className="muted">
            Tout reste sur ce téléphone. Range une sauvegarde dans iCloud Drive ou Google Drive pour tout retrouver en cas de
            perte ou de changement de téléphone.
          </p>
          <p className="status-line">
            <Icon name="shield" size={18} />
            Dernière sauvegarde :{' '}
            <strong>{backupAt ? new Date(backupAt).toLocaleDateString('fr-FR', { dateStyle: 'medium' }) : 'jamais'}</strong>
          </p>
          <button
            className="btn primary wide"
            disabled={busy}
            onClick={run(async () => {
              const r = await shareOrDownload(await exportAll(), 'Sauvegarde garde-robe')
              if (r === 'annulé') return
              await lastBackup.mark()
              return r === 'téléchargé' ? 'Sauvegarde téléchargée.' : 'Sauvegarde prête.'
            })}
          >
            <Icon name="download" /> Sauvegarder tout
          </button>
        </section>

        <section className="card" aria-labelledby="s-share">
          <h2 id="s-share">Partager avec l’autre téléphone</h2>
          <p className="muted">
            Envoie ta garde-robe par AirDrop, Messages ou WhatsApp. Sur l’autre téléphone, elle arrive dans Tenues → Reçues,
            pour assortir vos tenues. Pour une seule tenue : Tenues, puis la tenue, puis Partager.
          </p>
          <button
            className="btn secondary wide"
            disabled={busy}
            onClick={run(async () => {
              const r = await shareOrDownload(await exportWardrobe(), 'Ma garde-robe')
              if (r === 'téléchargé') return 'Fichier téléchargé : envoie-le à l’autre téléphone.'
            })}
          >
            <Icon name="share" /> Partager ma garde-robe
          </button>
        </section>

        <section className="card" aria-labelledby="s-import">
          <h2 id="s-import">Importer un fichier</h2>
          <p className="muted">Une sauvegarde est restaurée ; un partage est ajouté aux tenues reçues. Rien n’est supprimé.</p>
          <label className={`btn secondary wide ${busy ? 'disabled' : ''}`}>
            <Icon name="upload" /> Choisir un fichier
            <input
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                void run(async () => {
                  const r = await importFile(f)
                  return `${r.kind === 'sauvegarde' ? 'Sauvegarde restaurée' : 'Partage reçu'} : ${r.items} vêtement${r.items > 1 ? 's' : ''}, ${r.outfits} tenue${r.outfits > 1 ? 's' : ''}.`
                })()
              }}
            />
          </label>
        </section>

        <section className="card" aria-labelledby="s-storage">
          <h2 id="s-storage">Stockage</h2>
          <p className="status-line">
            <span className={`dot ${persisted ? 'ok' : 'warn'}`} aria-hidden="true" />
            {persisted === undefined ? '…' : persisted ? 'Protégé contre l’effacement automatique' : 'Non protégé contre l’effacement automatique'}
          </p>
          {persisted === false && (
            <>
              <p className="muted">
                Sur iPhone, installe l’app sur l’écran d’accueil (Partager, puis « Sur l’écran d’accueil ») : Safari peut sinon
                effacer les données d’un site inutilisé pendant quelques semaines.
              </p>
              <button className="btn secondary wide" onClick={() => void requestPersistence().then(setPersisted)}>
                Demander la protection
              </button>
            </>
          )}
        </section>
      </div>
    </>
  )
}
