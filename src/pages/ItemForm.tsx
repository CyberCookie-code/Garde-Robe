import { useRef, useState } from 'react'
import { CATEGORIES, PALETTE, PATTERNS, SEASONS, labelOf } from '../domain/catalog'
import { MATERIAL_OPTIONS } from '../domain/materials'
import type { Category, ColorTag, Item, Material, Pattern, Season } from '../domain/types'
import { compressPhoto, guessColors, isCutout } from '../data/photo'
import { prefs } from '../data/prefs'
import { repo } from '../data/repo'
import { Chips, Sheet } from '../components/ui'
import { toast } from '../components/toast'
import { useBlobUrl } from '../components/hooks'
import { Icon } from '../components/icons'

type Level = 1 | 2 | 3 | 4 | 5
const WARMTH = ['', 'Très léger', 'Léger', 'Moyen', 'Chaud', 'Très chaud']
const FORMALITY = ['', 'Sport', 'Décontracté', 'Casual chic', 'Habillé', 'Très habillé']
/** Chaleur par défaut selon la catégorie, modifiable dans « Plus de détails ». */
const DEFAULT_WARMTH: Record<Category, Level> = {
  haut: 2,
  bas: 2,
  robe: 2,
  veste: 3,
  manteau: 4,
  chaussures: 2,
  accessoire: 1,
}

interface Props {
  item?: Item
  onClose: () => void
}

/** Ajout rapide (photo → catégorie → c'est fini) ou modification d'un vêtement existant. */
export function ItemForm({ item, onClose }: Props) {
  const editing = !!item
  const [photo, setPhoto] = useState<Blob | undefined>(item?.photo)
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category | undefined>(item?.category)
  const [colors, setColors] = useState<ColorTag[]>(item?.colors ?? [])
  const [guessed, setGuessed] = useState(false)
  /** Photo d'origine et version détourée de la photo prise dans ce formulaire, pour basculer de l'une à l'autre. */
  const [original, setOriginal] = useState<Blob>()
  const [cut, setCut] = useState<Blob>()
  const [cutting, setCutting] = useState<false | 'first' | 'again'>(false)
  const pickedColors = useRef(editing && (item?.colors.length ?? 0) > 0)
  const lastPhoto = useRef<Blob | undefined>(undefined)
  const [materials, setMaterials] = useState<Material[]>(item?.materials ?? [])
  const [pattern, setPattern] = useState<Pattern>(item?.pattern ?? 'uni')
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons ?? [])
  const [warmth, setWarmth] = useState<Level>(item?.warmth ?? 2)
  const [warmthTouched, setWarmthTouched] = useState(editing)
  const [formality, setFormality] = useState<Level>(item?.formality ?? 2)
  const [waterproof, setWaterproof] = useState(item?.waterproof ?? false)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(0)
  const preview = useBlobUrl(photo)

  const toggleColor = (c: ColorTag) => {
    setGuessed(false)
    pickedColors.current = true
    setColors((cs) => (cs.some((x) => x.hex === c.hex) ? cs.filter((x) => x.hex !== c.hex) : [...cs, c]))
  }

  const pickCategory = (c: Category) => {
    setCategory(c)
    if (!warmthTouched) setWarmth(DEFAULT_WARMTH[c])
  }

  /** Couleurs devinées sur la photo affichée, sauf si l'utilisateur les a choisies lui-même. */
  async function guessFrom(blob: Blob) {
    if (pickedColors.current) return
    try {
      const found = await guessColors(blob, PALETTE)
      if (found.length && !pickedColors.current && lastPhoto.current === blob) {
        setColors(found)
        setGuessed(true)
      }
    } catch {
      /* suggestion seulement */
    }
  }

  function show(blob: Blob) {
    lastPhoto.current = blob
    setPhoto(blob)
    void guessFrom(blob)
  }

  async function cutoutPhoto(src: Blob) {
    setCutting(prefs.cutoutReady.get() ? 'again' : 'first')
    try {
      const { removeBackground } = await import('../data/cutout')
      const out = await removeBackground(src)
      prefs.cutoutReady.set()
      // L'utilisateur a pu reprendre une photo entre-temps : on ne remplace que la bonne.
      if (lastPhoto.current !== src) return
      setCut(out)
      show(out)
    } catch (e) {
      if (lastPhoto.current !== src) return
      const { CutoutError } = await import('../data/cutout')
      toast(e instanceof CutoutError ? `${e.message} Photo gardée telle quelle.` : 'Détourage impossible pour l’instant. Photo gardée telle quelle.')
    } finally {
      setCutting(false)
    }
  }

  async function onPhoto(file: File) {
    const blob = await compressPhoto(file)
    setOriginal(blob)
    setCut(undefined)
    show(blob)
    if (prefs.autoCutout.get()) void cutoutPhoto(blob)
  }

  const autoName = () => {
    const base = category ? labelOf(CATEGORIES, category).split(' /')[0] : 'Vêtement'
    return colors[0] ? `${base} ${colors[0].name.toLowerCase()}` : base
  }

  function reset() {
    lastPhoto.current = undefined
    pickedColors.current = false
    setPhoto(undefined)
    setOriginal(undefined)
    setCut(undefined)
    setName('')
    setColors([])
    setGuessed(false)
    setPattern('uni')
    setMaterials([])
    setWaterproof(false)
    setWarmthTouched(false)
    if (category) setWarmth(DEFAULT_WARMTH[category])
  }

  async function save(again: boolean) {
    if (!category) return
    setBusy(true)
    const data = { photo, name: name.trim() || autoName(), category, colors, materials, pattern, seasons, warmth, formality, waterproof }
    try {
      if (item) {
        await repo.items.update(item.id, data)
        toast('Modifications enregistrées.')
        onClose()
      } else {
        await repo.items.add({ ...data, tags: [] })
        toast(`${data.name} ajouté.`)
        if (again) {
          reset()
          setAdded((n) => n + 1)
          // Pas d'ouverture automatique de l'appareil photo : iOS l'interdit hors d'un geste direct.
          document.querySelector('.sheet-body')?.scrollTo({ top: 0, behavior: 'smooth' })
        } else onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <div className="foot-actions">
      {!editing && (
        <button className="btn secondary" disabled={!category || busy || !!cutting} onClick={() => void save(true)}>
          Ajouter + suivant
        </button>
      )}
      <button className="btn primary" disabled={!category || busy || !!cutting} onClick={() => void save(false)}>
        {editing ? 'Enregistrer' : 'Ajouter'}
      </button>
    </div>
  )

  return (
    <Sheet title={editing ? 'Modifier le vêtement' : added ? `Vêtement n° ${added + 1}` : 'Nouveau vêtement'} onClose={onClose} footer={footer}>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label className={`photo-input ${preview ? 'has-photo' : ''} ${isCutout(photo) ? 'cutout' : ''}`}>
          {preview ? (
            <>
              <img src={preview} alt="Photo du vêtement" />
              {!cutting && (
                <span className="photo-change">
                  <Icon name="camera" size={18} /> Changer
                </span>
              )}
              {cutting && (
                <span className="photo-busy" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Détourage…
                  {cutting === 'first' && <small>Premier usage : téléchargement unique de l’outil, puis il marche hors ligne.</small>}
                </span>
              )}
            </>
          ) : (
            <span className="photo-cta">
              <span className="photo-icon">
                <Icon name="camera" size={30} />
              </span>
              <strong>Prendre une photo</strong>
              <small>À plat ou sur un cintre, sur un fond uni</small>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="visually-hidden"
            disabled={!!cutting}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onPhoto(f)
            }}
          />
        </label>

        {photo && !cutting && (
          <div className="photo-tools">
            {isCutout(photo) ? (
              <>
                <span className="muted">Fond retiré</span>
                {original && (
                  <button type="button" className="btn small ghost" onClick={() => show(original)}>
                    Remettre le fond
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="muted">Photo d’origine</span>
                <button type="button" className="btn small ghost" onClick={() => (cut ? show(cut) : void cutoutPhoto(photo))}>
                  <Icon name="scissors" size={16} /> Retirer le fond
                </button>
              </>
            )}
          </div>
        )}

        <fieldset>
          <legend>
            Catégorie <span className="req">obligatoire</span>
          </legend>
          <Chips label="Catégorie" options={CATEGORIES} value={category ? [category] : []} onChange={([c]) => pickCategory(c)} single />
        </fieldset>

        <fieldset>
          <legend>
            Couleur{colors.length > 1 ? 's' : ''}
            {guessed && <span className="hint">détectée{colors.length > 1 ? 's' : ''} sur la photo</span>}
          </legend>
          <div className="swatches" role="group" aria-label="Couleurs">
            {PALETTE.map((c) => {
              const on = colors.some((x) => x.hex === c.hex)
              return (
                <button
                  type="button"
                  key={c.hex}
                  className={`swatch ${on ? 'on' : ''}`}
                  style={{ ['--sw' as string]: c.hex }}
                  onClick={() => toggleColor(c)}
                  aria-pressed={on}
                  aria-label={c.name}
                  title={c.name}
                >
                  {on && <Icon name="check" size={16} />}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            Matière{materials.length > 1 ? 's' : ''} <span className="hint">aide pour la météo et les occasions</span>
          </legend>
          <Chips label="Matières" options={MATERIAL_OPTIONS} value={materials} onChange={setMaterials} />
        </fieldset>

        <label className="field">
          <span>Nom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={category ? autoName() : 'ex. Chemise en lin'} />
        </label>

        <details className="more" open={editing}>
          <summary>
            Plus de détails <span className="muted">saisons, chaleur, style…</span>
          </summary>
          <div className="form">
            <fieldset>
              <legend>Saisons <span className="hint">aucune = toute l’année</span></legend>
              <Chips label="Saisons" options={SEASONS} value={seasons} onChange={setSeasons} />
            </fieldset>
            <fieldset>
              <legend>
                Chaleur <span className="hint">{WARMTH[warmth]}</span>
              </legend>
              <Scale
                label="Chaleur"
                value={warmth}
                onChange={(v) => {
                  setWarmth(v)
                  setWarmthTouched(true)
                }}
                ends={['Léger', 'Chaud']}
              />
            </fieldset>
            <fieldset>
              <legend>
                Style <span className="hint">{FORMALITY[formality]}</span>
              </legend>
              <Scale label="Style" value={formality} onChange={setFormality} ends={['Sport', 'Habillé']} />
            </fieldset>
            <fieldset>
              <legend>Motif</legend>
              <Chips label="Motif" options={PATTERNS} value={[pattern]} onChange={([p]) => setPattern(p)} single />
            </fieldset>
            <label className="switch">
              <input type="checkbox" checked={waterproof} onChange={(e) => setWaterproof(e.target.checked)} />
              <span>Imperméable, résiste à la pluie</span>
            </label>
          </div>
        </details>

        {editing && (
          <button
            type="button"
            className="btn danger wide"
            onClick={async () => {
              if (!confirm(`Retirer « ${item.name} » de la garde-robe ?`)) return
              await repo.items.archive(item.id)
              toast(`${item.name} retiré.`, { label: 'Annuler', run: () => void repo.items.update(item.id, { archived: false }) })
              onClose()
            }}
          >
            <Icon name="trash" /> Retirer de la garde-robe
          </button>
        )}
      </form>
    </Sheet>
  )
}

function Scale(props: { label: string; value: Level; onChange: (v: Level) => void; ends: [string, string] }) {
  return (
    <div className="scale">
      <div className="scale-steps" role="radiogroup" aria-label={props.label}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={props.value === n}
            aria-label={`${n} sur 5`}
            className={n <= props.value ? 'on' : ''}
            onClick={() => props.onChange(n)}
          />
        ))}
      </div>
      <div className="scale-ends" aria-hidden="true">
        <span>{props.ends[0]}</span>
        <span>{props.ends[1]}</span>
      </div>
    </div>
  )
}
