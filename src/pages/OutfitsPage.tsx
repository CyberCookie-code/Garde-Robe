import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { CATEGORIES, OCCASIONS, SEASONS, labelOf } from '../domain/catalog'
import { ME, RECEIVED, type Id, type Item, type Occasion, type Outfit, type Owner, type Season } from '../domain/types'
import { repo, today } from '../data/repo'
import { exportOutfit, shareOrDownload } from '../data/backup'
import { Chips, Collage, EmptyState, ItemThumb, PageHeader, Segmented, Sheet } from '../components/ui'
import { toast } from '../components/toast'
import { Icon } from '../components/icons'
import type { Go, Intent } from '../App'

export function OutfitsPage({ go, intent, clearIntent }: { go: Go; intent: Intent; clearIntent: () => void }) {
  const [owner, setOwner] = useState<Owner>(ME)
  const outfits = useLiveQuery(() => repo.outfits.list(owner), [owner])
  const receivedCount = useLiveQuery(() => repo.outfits.count(RECEIVED)) ?? 0
  const allItems = useLiveQuery(() => repo.items.all())
  const myItems = allItems?.filter((i) => i.ownerId === ME) ?? []
  const [building, setBuilding] = useState(() => intent === 'new-outfit')
  const [open, setOpen] = useState<Outfit>()
  const byId = new Map(allItems?.map((i) => [i.id, i]))
  const piecesOf = (o: Outfit) => o.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i)

  useEffect(() => {
    if (intent) clearIntent()
  }, [intent, clearIntent])

  const sorted = outfits ? [...outfits].sort((a, b) => Number(b.favorite) - Number(a.favorite)) : []

  return (
    <>
      <PageHeader title="Tenues" eyebrow={outfits ? `${outfits.length} tenue${outfits.length > 1 ? 's' : ''}` : undefined} />

      {receivedCount > 0 && (
        <Segmented
          label="Tenues affichées"
          value={owner}
          onChange={setOwner}
          options={[
            { value: ME, label: 'Mes tenues' },
            { value: RECEIVED, label: `Reçues (${receivedCount})` },
          ]}
        />
      )}

      {outfits && outfits.length === 0 && owner === ME && (
        <EmptyState
          icon="layers"
          title={myItems.length ? 'Aucune tenue enregistrée' : 'Ajoute d’abord des vêtements'}
          action={
            myItems.length ? (
              <button className="btn primary" onClick={() => setBuilding(true)}>
                <Icon name="plus" /> Composer une tenue
              </button>
            ) : (
              <button className="btn primary" onClick={() => go('wardrobe', 'add-item')}>
                <Icon name="camera" /> Ajouter un vêtement
              </button>
            )
          }
        >
          Prépare tes tenues à l’avance : le matin, l’app choisit parmi elles selon la météo et ton programme.
        </EmptyState>
      )}

      <ul className="outfit-list" aria-label="Tenues">
        {sorted.map((o) => (
          <li key={o.id} className="outfit-card">
            <button className="outfit-open" onClick={() => setOpen(o)} aria-label={`${o.name}, détails`}>
              <Collage items={piecesOf(o)} className="mini" />
              <span className="outfit-text">
                <strong>{o.name}</strong>
                <span className="muted">
                  {[
                    ...o.occasions.map((x) => labelOf(OCCASIONS, x)),
                    o.wearCount ? `portée ${o.wearCount}×` : 'jamais portée',
                  ].join(' · ')}
                </span>
              </span>
            </button>
            <button
              className={`icon-btn star ${o.favorite ? 'on' : ''}`}
              aria-pressed={o.favorite}
              aria-label={o.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={() => repo.outfits.update(o.id, { favorite: !o.favorite })}
            >
              <Icon name="star" filled={o.favorite} />
            </button>
          </li>
        ))}
      </ul>

      {owner === ME && myItems.length > 0 && (
        <button className="fab" onClick={() => setBuilding(true)} aria-label="Composer une tenue">
          <Icon name="plus" size={26} />
        </button>
      )}

      {building && <OutfitBuilder items={myItems} onDone={() => setBuilding(false)} />}
      {open && <OutfitDetail outfit={open} pieces={piecesOf(open)} go={go} onClose={() => setOpen(undefined)} />}
    </>
  )
}

function OutfitDetail({ outfit, pieces, go, onClose }: { outfit: Outfit; pieces: Item[]; go: Go; onClose: () => void }) {
  const mine = outfit.ownerId === ME
  return (
    <Sheet title={outfit.name} onClose={onClose}>
      <Collage items={pieces} className="hero-collage" />
      <ul className="piece-list">
        {pieces.map((p) => (
          <li key={p.id}>
            <ItemThumb item={p} className="xs" />
            <span>{p.name}</span>
            <span className="muted">{labelOf(CATEGORIES, p.category).split(' /')[0]}</span>
          </li>
        ))}
      </ul>
      <div className="stack">
        {mine && (
          <button
            className="btn primary wide"
            onClick={async () => {
              await repo.wear.log(outfit)
              toast('Notée comme tenue du jour.')
              onClose()
              go('today')
            }}
          >
            <Icon name="check" /> La porter aujourd’hui
          </button>
        )}
        <button
          className="btn secondary wide"
          onClick={async () => {
            const r = await shareOrDownload(await exportOutfit(outfit.id), outfit.name)
            if (r === 'téléchargé') toast('Fichier téléchargé : envoie-le à l’autre téléphone.')
          }}
        >
          <Icon name="share" /> Partager
        </button>
        <button
          className="btn danger wide"
          onClick={async () => {
            if (!confirm(`Supprimer la tenue « ${outfit.name} » ? Les vêtements restent dans la garde-robe.`)) return
            await repo.outfits.remove(outfit.id)
            toast('Tenue supprimée.', { label: 'Annuler', run: () => void repo.outfits.restore(outfit) })
            onClose()
          }}
        >
          <Icon name="trash" /> Supprimer la tenue
        </button>
      </div>
    </Sheet>
  )
}

function OutfitBuilder({ items, onDone }: { items: Item[]; onDone: () => void }) {
  const [selected, setSelected] = useState<Id[]>([])
  const [name, setName] = useState('')
  const [seasons, setSeasons] = useState<Season[]>()
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const toggle = (id: Id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const chosen = selected.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i)

  // Saisons proposées = celles que toutes les pièces choisies ont en commun.
  const suggestedSeasons = SEASONS.map((s) => s.value).filter((s) => chosen.every((it) => it.seasons.length === 0 || it.seasons.includes(s)))
  const effectiveSeasons = seasons ?? (suggestedSeasons.length === 4 ? [] : suggestedSeasons)

  async function save() {
    await repo.outfits.add({
      name: name.trim() || `Tenue du ${new Date(today()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
      itemIds: selected,
      seasons: effectiveSeasons,
      occasions,
      moods: [],
      favorite: false,
      source: 'manuel',
    })
    toast('Tenue enregistrée.')
    onDone()
  }

  return (
    <Sheet
      title="Nouvelle tenue"
      onClose={onDone}
      footer={
        <div className="foot-actions">
          <div className="chosen" aria-live="polite">
            {chosen.length === 0 ? (
              <span className="muted">Choisis les pièces</span>
            ) : (
              chosen.map((i) => (
                <button key={i.id} className="chosen-item" onClick={() => toggle(i.id)} aria-label={`Retirer ${i.name}`}>
                  <ItemThumb item={i} className="xs" />
                </button>
              ))
            )}
          </div>
          <button className="btn primary" disabled={chosen.length === 0} onClick={() => void save()}>
            Enregistrer
          </button>
        </div>
      }
    >
      <div className="form">
        {CATEGORIES.map((c) => {
          const list = items.filter((i) => i.category === c.value)
          if (!list.length) return null
          return (
            <fieldset key={c.value}>
              <legend>{c.label}</legend>
              <div className="picker" role="group" aria-label={c.label}>
                {list.map((i) => {
                  const on = selected.includes(i.id)
                  return (
                    <button key={i.id} type="button" className={`pick ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(i.id)}>
                      <ItemThumb item={i} />
                      {on && (
                        <span className="pick-check">
                          <Icon name="check" size={16} />
                        </span>
                      )}
                      <span className="pick-name">{i.name}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        <label className="field">
          <span>Nom de la tenue</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Bureau décontracté" />
        </label>
        <fieldset>
          <legend>Pour quelles occasions ?</legend>
          <Chips label="Occasions" options={OCCASIONS} value={occasions} onChange={setOccasions} />
        </fieldset>
        <fieldset>
          <legend>
            Saisons {seasons === undefined && effectiveSeasons.length > 0 && <span className="hint">déduites des pièces</span>}
          </legend>
          <Chips label="Saisons" options={SEASONS} value={effectiveSeasons} onChange={setSeasons} />
        </fieldset>
      </div>
    </Sheet>
  )
}
