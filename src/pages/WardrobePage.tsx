import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CATEGORIES } from '../domain/catalog'
import type { Category, Id } from '../domain/types'
import { repo } from '../data/repo'
import { Empty, ItemThumb, Sheet } from '../components/ui'
import { ItemForm } from './ItemForm'

export function WardrobePage({ profileId }: { profileId: Id }) {
  const items = useLiveQuery(() => repo.items.listByOwner(profileId), [profileId])
  const [filter, setFilter] = useState<Category | 'tout'>('tout')
  const [adding, setAdding] = useState(false)

  const shown = items?.filter((i) => filter === 'tout' || i.category === filter) ?? []

  return (
    <section>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as Category | 'tout')}>
          <option value="tout">Tout ({items?.length ?? 0})</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => setAdding(true)}>
          + Vêtement
        </button>
      </div>

      {items && shown.length === 0 && <Empty>Aucun vêtement ici. Commence par photographier tes pièces préférées.</Empty>}

      <div className="grid">
        {shown.map((i) => (
          <div key={i.id} className="card">
            <ItemThumb item={i} />
            <div className="card-meta">
              <span>{i.name}</span>
              <span className="dots">
                {i.colors.map((c) => (
                  <i key={c.hex} style={{ background: c.hex }} />
                ))}
              </span>
            </div>
            <button
              className="ghost small"
              onClick={() => confirm(`Retirer « ${i.name} » ?`) && repo.items.archive(i.id)}
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <Sheet title="Nouveau vêtement" onClose={() => setAdding(false)}>
          <ItemForm ownerId={profileId} onDone={() => setAdding(false)} />
        </Sheet>
      )}
    </section>
  )
}
