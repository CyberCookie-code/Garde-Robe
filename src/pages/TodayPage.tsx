import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CATEGORIES } from '../domain/catalog'
import type { Id, Item } from '../domain/types'
import { repo, today } from '../data/repo'
import { exportAll, lastBackup, shareOrDownload } from '../data/backup'
import { rankOutfits, seasonOf } from '../matching/engine'
import { Empty, ItemThumb } from '../components/ui'

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

  if (!data) return null
  const items = new Map(data.items.map((i) => [i.id, i]))
  // On exclut la tenue déjà portée aujourd'hui du calcul de récence pour qu'elle reste affichée.
  const recentWear = data.recentWear.filter((w) => w.date !== date)
  const ranked = rankOutfits(data.outfits, { date, season: seasonOf(new Date()), items, recentWear })

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
