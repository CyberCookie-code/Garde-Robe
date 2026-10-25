import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CATEGORIES, OCCASIONS, SEASONS } from '../domain/catalog'
import type { Id, Item, Occasion, Season } from '../domain/types'
import { repo } from '../data/repo'
import { exportOutfit, shareOrDownload } from '../data/backup'
import { Chips, Empty, ItemThumb, Sheet } from '../components/ui'

export function OutfitsPage({ profileId }: { profileId: Id }) {
  const outfits = useLiveQuery(() => repo.outfits.listByOwner(profileId), [profileId])
  const items = useLiveQuery(() => repo.items.listByOwner(profileId), [profileId])
  const [building, setBuilding] = useState(false)
  const byId = new Map(items?.map((i) => [i.id, i]))

  return (
    <section>
      <div className="toolbar">
        <span className="muted">{outfits?.length ?? 0} tenue(s)</span>
        <button className="primary" onClick={() => setBuilding(true)} disabled={!items?.length}>
          + Tenue
        </button>
      </div>

      {outfits && outfits.length === 0 && (
        <Empty>Compose des tenues à l'avance : ce sont elles qui seront proposées le matin.</Empty>
      )}

      <ul className="outfits">
        {outfits?.map((o) => (
          <li key={o.id} className="outfit">
            <header>
              <strong>{o.name}</strong>
              <span>
                <button
                  className="ghost"
                  aria-label="favorite"
                  onClick={() => repo.outfits.update(o.id, { favorite: !o.favorite })}
                >
                  {o.favorite ? '★' : '☆'}
                </button>
                <button className="ghost small" onClick={async () => shareOrDownload(await exportOutfit(o.id), o.name)}>
                  Partager
                </button>
                <button className="ghost small" onClick={() => confirm('Supprimer cette tenue ?') && repo.outfits.remove(o.id)}>
                  Supprimer
                </button>
              </span>
            </header>
            <div className="strip">
              {o.itemIds.map((id) => {
                const it = byId.get(id)
                return it ? <ItemThumb key={id} item={it} size="sm" /> : null
              })}
            </div>
            <small className="muted">
              {[...o.seasons.map((s) => SEASONS.find((x) => x.value === s)?.label), ...o.occasions].join(' · ') ||
                'Toutes saisons'}
              {o.wearCount > 0 && ` · portée ${o.wearCount}×`}
            </small>
          </li>
        ))}
      </ul>

      {building && items && (
        <Sheet title="Nouvelle tenue" onClose={() => setBuilding(false)}>
          <OutfitBuilder profileId={profileId} items={items} onDone={() => setBuilding(false)} />
        </Sheet>
      )}
    </section>
  )
}

function OutfitBuilder({ profileId, items, onDone }: { profileId: Id; items: Item[]; onDone: () => void }) {
  const [selected, setSelected] = useState<Id[]>([])
  const [name, setName] = useState('')
  const [seasons, setSeasons] = useState<Season[]>([])
  const [occasions, setOccasions] = useState<Occasion[]>([])

  const toggle = (id: Id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // Les saisons de la tenue = intersection de celles des vêtements, proposée par défaut.
  const suggestedSeasons = SEASONS.map((s) => s.value).filter((s) =>
    selected.every((id) => {
      const it = items.find((i) => i.id === id)
      return !it || it.seasons.length === 0 || it.seasons.includes(s)
    }),
  )

  async function save() {
    await repo.outfits.add({
      ownerId: profileId,
      name: name.trim() || `Tenue du ${new Date().toLocaleDateString('fr-FR')}`,
      itemIds: selected,
      seasons: seasons.length ? seasons : suggestedSeasons.length === 4 ? [] : suggestedSeasons,
      occasions,
      moods: [],
      favorite: false,
      source: 'manuel',
    })
    onDone()
  }

  return (
    <div className="form">
      {CATEGORIES.map((c) => {
        const list = items.filter((i) => i.category === c.value)
        if (!list.length) return null
        return (
          <fieldset key={c.value}>
            <legend>{c.label}</legend>
            <div className="strip">
              {list.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className={`pick ${selected.includes(i.id) ? 'on' : ''}`}
                  onClick={() => toggle(i.id)}
                >
                  <ItemThumb item={i} size="sm" />
                </button>
              ))}
            </div>
          </fieldset>
        )
      })}

      <label>
        Nom
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Bureau décontracté" />
      </label>
      <fieldset>
        <legend>Saisons {seasons.length === 0 && suggestedSeasons.length < 4 && '(déduites des vêtements)'}</legend>
        <Chips options={SEASONS} value={seasons.length ? seasons : suggestedSeasons} onChange={setSeasons} />
      </fieldset>
      <fieldset>
        <legend>Occasions</legend>
        <Chips options={OCCASIONS} value={occasions} onChange={setOccasions} />
      </fieldset>

      <button className="primary" disabled={selected.length < 2} onClick={() => void save()}>
        Enregistrer ({selected.length} pièces)
      </button>
    </div>
  )
}
