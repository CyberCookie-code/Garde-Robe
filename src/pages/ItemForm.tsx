import { useState } from 'react'
import { CATEGORIES, PALETTE, PATTERNS, SEASONS } from '../domain/catalog'
import type { Category, ColorTag, Id, Pattern, Season } from '../domain/types'
import { compressPhoto } from '../data/photo'
import { repo } from '../data/repo'
import { Chips, useBlobUrl } from '../components/ui'

const LEVELS = [1, 2, 3, 4, 5] as const

export function ItemForm({ ownerId, onDone }: { ownerId: Id; onDone: () => void }) {
  const [photo, setPhoto] = useState<Blob>()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('haut')
  const [colors, setColors] = useState<ColorTag[]>([])
  const [pattern, setPattern] = useState<Pattern>('uni')
  const [seasons, setSeasons] = useState<Season[]>([])
  const [warmth, setWarmth] = useState<(typeof LEVELS)[number]>(3)
  const [formality, setFormality] = useState<(typeof LEVELS)[number]>(2)
  const [waterproof, setWaterproof] = useState(false)
  const [busy, setBusy] = useState(false)
  const preview = useBlobUrl(photo)

  const toggleColor = (c: ColorTag) =>
    setColors((cs) => (cs.some((x) => x.hex === c.hex) ? cs.filter((x) => x.hex !== c.hex) : [...cs, c]))

  async function save() {
    setBusy(true)
    await repo.items.add({
      ownerId,
      photo,
      name: name.trim() || CATEGORIES.find((c) => c.value === category)!.label,
      category,
      colors,
      pattern,
      seasons,
      warmth,
      formality,
      waterproof,
      tags: [],
    })
    onDone()
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label className="photo-input">
        {preview ? <img src={preview} alt="aperçu" /> : <span>📷 Prendre / choisir une photo</span>}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setPhoto(await compressPhoto(f))
          }}
        />
      </label>

      <label>
        Nom
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Chemise en lin blanche" />
      </label>

      <fieldset>
        <legend>Catégorie</legend>
        <Chips options={CATEGORIES} value={[category]} onChange={([c]) => setCategory(c)} single />
      </fieldset>

      <fieldset>
        <legend>Couleurs ({colors.length})</legend>
        <div className="swatches">
          {PALETTE.map((c) => (
            <button
              type="button"
              key={c.hex}
              className={`swatch ${colors.some((x) => x.hex === c.hex) ? 'on' : ''}`}
              style={{ background: c.hex }}
              onClick={() => toggleColor(c)}
              aria-label={c.name}
              title={c.name}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Motif</legend>
        <Chips options={PATTERNS} value={[pattern]} onChange={([p]) => setPattern(p)} single />
      </fieldset>

      <fieldset>
        <legend>Saisons (aucune = toutes)</legend>
        <Chips options={SEASONS} value={seasons} onChange={setSeasons} />
      </fieldset>

      <fieldset>
        <legend>Chaleur : {['', 'très léger', 'léger', 'moyen', 'chaud', 'très chaud'][warmth]}</legend>
        <input type="range" min={1} max={5} value={warmth} onChange={(e) => setWarmth(+e.target.value as 1)} />
      </fieldset>

      <fieldset>
        <legend>Style : {['', 'très décontracté', 'décontracté', 'smart casual', 'habillé', 'très habillé'][formality]}</legend>
        <input type="range" min={1} max={5} value={formality} onChange={(e) => setFormality(+e.target.value as 1)} />
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={waterproof} onChange={(e) => setWaterproof(e.target.checked)} />
        Imperméable / résiste à la pluie
      </label>

      <button className="primary" disabled={busy}>
        Ajouter à la garde-robe
      </button>
    </form>
  )
}
