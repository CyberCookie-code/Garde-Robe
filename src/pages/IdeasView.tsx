import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CATEGORIES } from '../domain/catalog'
import type { Item } from '../domain/types'
import { meta } from '../data/db'
import { repo } from '../data/repo'
import { composeOutfits, missingForCompose, type Idea } from '../matching/composer'
import type { MatchContext } from '../matching/engine'
import { Collage, EmptyState, ItemThumb } from '../components/ui'
import { toast } from '../components/toast'
import { Icon } from '../components/icons'
import type { Go } from '../App'

const REFUSED = 'composer:refused'
const refused = {
  list: async (): Promise<string[]> => JSON.parse((await meta.get(REFUSED)) ?? '[]'),
  async add(key: string) {
    await meta.set(REFUSED, JSON.stringify([...(await refused.list()), key]))
  },
  async remove(key: string) {
    await meta.set(REFUSED, JSON.stringify((await refused.list()).filter((k) => k !== key)))
  },
}

const catOrder = (i: Item) => CATEGORIES.findIndex((c) => c.value === i.category)

const toOutfit = (idea: Idea) => ({
  name: idea.name,
  itemIds: idea.items.map((i) => i.id),
  seasons: [],
  occasions: [],
  moods: [],
  favorite: false,
  source: 'regles' as const,
})

/** Tenues composées par l'app à partir des vêtements, avec le pourquoi. */
export function IdeasView(props: {
  items: Item[]
  ctx: MatchContext
  saved: string[][]
  go: Go
  /** Appelé avant d'enregistrer : l'écran reste sur les idées même quand c'était la première tenue. */
  stay: () => void
}) {
  const { items, ctx, saved, go, stay } = props
  const refusedKeys = useLiveQuery(refused.list, [])
  const [skip, setSkip] = useState(0)

  const missing = missingForCompose(items)
  if (missing)
    return (
      <EmptyState
        icon="hanger"
        title="Encore quelques pièces"
        action={
          <button className="btn primary" onClick={() => go('wardrobe', 'add-item')}>
            <Icon name="camera" /> Ajouter un vêtement
          </button>
        }
      >
        {missing}
      </EmptyState>
    )

  if (!refusedKeys) return null
  const ideas = composeOutfits(items, ctx, { saved, refused: refusedKeys })

  if (ideas.length === 0)
    return (
      <EmptyState icon="layers" title="Plus d’idées pour aujourd’hui">
        Toutes les combinaisons qui tiennent la route sont déjà enregistrées ou écartées. Ajoute des vêtements pour en
        avoir de nouvelles.
      </EmptyState>
    )

  const idea = ideas[skip % ideas.length]
  const pieces = [...idea.items].sort((a, b) => catOrder(a) - catOrder(b))

  const save = async () => {
    stay()
    const id = await repo.outfits.add(toOutfit(idea))
    toast('Tenue enregistrée.', { label: 'Annuler', run: () => void repo.outfits.remove(id) })
  }
  const wear = async () => {
    const id = await repo.outfits.add(toOutfit(idea))
    const outfit = await repo.outfits.get(id)
    if (outfit) await repo.wear.log(outfit, { occasion: ctx.occasion })
    toast('Bonne journée ! La tenue est enregistrée.')
  }
  const refuse = async () => {
    await refused.add(idea.key)
    toast('On ne te proposera plus cette association.', { label: 'Annuler', run: () => void refused.remove(idea.key) })
  }

  return (
    <>
      <article className="outfit-hero" aria-live="polite">
        <div className="hero-media">
          <Collage items={pieces} className="hero-collage" />
          <div className="hero-overlay">
            <p className="glass">
              <Icon name="sparkle" size={14} /> Idée {(skip % ideas.length) + 1} sur {ideas.length}
            </p>
            <h2>{idea.name}</h2>
            {idea.reasons.length > 0 && (
              <ul className="reasons" aria-label="Pourquoi ça va ensemble">
                {idea.reasons.map((r) => (
                  <li key={r} className="glass">
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="hero-bar actions">
          <button
            className="btn dark"
            onClick={() => setSkip((s) => s + 1)}
            disabled={ideas.length < 2}
            aria-label={`Autre idée, ${(skip % ideas.length) + 1} sur ${ideas.length}`}
          >
            <Icon name="refresh" /> Autre idée
          </button>
          <button className="btn primary" onClick={() => void wear()}>
            <Icon name="check" /> Je la porte
          </button>
        </div>
        <div className="hero-bar idea-bar">
          <button className="btn dark" onClick={() => void refuse()}>
            <Icon name="close" /> Pas pour moi
          </button>
          <button className="btn dark" onClick={() => void save()}>
            <Icon name="star" /> Enregistrer
          </button>
        </div>
      </article>

      {idea.warnings.length > 0 && (
        <p className="idea-warning">
          <strong>À noter :</strong> {idea.warnings.join(', ')}.
        </p>
      )}

      <section aria-labelledby="idea-pieces-title">
        <h3 className="section-title" id="idea-pieces-title">
          Dans cette tenue
        </h3>
        <ul className="pieces">
          {pieces.map((p) => (
            <li key={p.id}>
              <ItemThumb item={p} />
              <span>{p.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="idea-note muted">
        Composée sur ton téléphone avec des règles de stylisme (couleurs, motifs, style, météo, occasion). Elles ne voient
        pas la coupe : plus tes vêtements sont bien renseignés, meilleures sont les idées.
      </p>
    </>
  )
}
