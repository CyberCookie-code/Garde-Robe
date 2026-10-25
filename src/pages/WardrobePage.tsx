import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { CATEGORIES } from '../domain/catalog'
import type { Category, Item } from '../domain/types'
import { repo } from '../data/repo'
import { Chips, EmptyState, ItemThumb, PageHeader } from '../components/ui'
import { Icon } from '../components/icons'
import { ItemForm } from './ItemForm'
import type { Intent } from '../App'

export function WardrobePage({ intent, clearIntent }: { intent: Intent; clearIntent: () => void }) {
  const items = useLiveQuery(() => repo.items.list())
  const [filter, setFilter] = useState<Category | 'tout'>('tout')
  const [editing, setEditing] = useState<Item | 'new' | undefined>(() => (intent === 'add-item' ? 'new' : undefined))

  useEffect(() => {
    if (intent) clearIntent()
  }, [intent, clearIntent])

  const counts = new Map<Category, number>()
  items?.forEach((i) => counts.set(i.category, (counts.get(i.category) ?? 0) + 1))
  const filters = [
    { value: 'tout' as const, label: 'Tout', count: items?.length ?? 0 },
    ...CATEGORIES.filter((c) => counts.has(c.value)).map((c) => ({ ...c, label: c.label.split(' /')[0], count: counts.get(c.value) })),
  ]
  const shown = items?.filter((i) => filter === 'tout' || i.category === filter) ?? []

  return (
    <>
      <PageHeader
        title="Garde-robe"
        eyebrow={items ? `${items.length} vêtement${items.length > 1 ? 's' : ''}` : undefined}
      />

      {items && items.length === 0 ? (
        <EmptyState
          icon="camera"
          title="Aucun vêtement pour l’instant"
          action={
            <button className="btn primary" onClick={() => setEditing('new')}>
              <Icon name="camera" /> Ajouter un vêtement
            </button>
          }
        >
          Une photo et une catégorie suffisent : la couleur est devinée sur la photo. Avec « Ajouter + suivant », tu
          enchaînes sans fermer.
        </EmptyState>
      ) : (
        <>
          {filters.length > 2 && (
            <Chips label="Filtrer par catégorie" scroll single options={filters} value={[filter]} onChange={([f]) => setFilter(f)} />
          )}
          <ul className="grid" aria-label="Vêtements">
            {shown.map((i) => (
              <li key={i.id}>
                <button className="tile" onClick={() => setEditing(i)} aria-label={`${i.name}, modifier`}>
                  <ItemThumb item={i} />
                  <span className="tile-name">{i.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Ajouter un vêtement">
        <Icon name="plus" size={26} />
      </button>

      {editing && <ItemForm item={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}
