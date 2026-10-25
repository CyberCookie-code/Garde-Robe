import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useBlobUrl } from './hooks'
import { dismissToast, subscribeToasts, getToasts } from './toast'
import type { Item } from '../domain/types'
import { Icon, type IconName } from './icons'

export function ItemThumb({ item, className = '' }: { item: Item; className?: string }) {
  const url = useBlobUrl(item.photo)
  return (
    <div className={`thumb ${className}`}>
      {url ? (
        <img src={url} alt={item.name} loading="lazy" />
      ) : (
        <div className="thumb-placeholder" style={{ background: item.colors[0]?.hex ?? 'var(--surface-2)' }}>
          <span>{item.name.slice(0, 1)}</span>
        </div>
      )}
    </div>
  )
}

/** Mosaïque des pièces d'une tenue : 1 grande photo, 1+2, ou grille 2×2. */
export function Collage({ items, max = 4, className = '' }: { items: Item[]; max?: number; className?: string }) {
  const shown = items.slice(0, max)
  const more = items.length - shown.length
  return (
    <div className={`collage collage-${Math.min(shown.length, 4)} ${className}`} role="img" aria-label={items.map((i) => i.name).join(', ')}>
      {shown.map((it, i) => (
        <div key={it.id} className="collage-cell">
          <ItemThumb item={it} />
          {more > 0 && i === shown.length - 1 && <span className="collage-more">+{more}</span>}
        </div>
      ))}
    </div>
  )
}

export function Chips<T extends string>(props: {
  options: { value: T; label: string; count?: number }[]
  value: T[]
  onChange: (v: T[]) => void
  single?: boolean
  scroll?: boolean
  label: string
}) {
  const { options, value, onChange, single, scroll, label } = props
  return (
    <div className={`chips ${scroll ? 'chips-scroll' : ''}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            type="button"
            key={o.value}
            className={`chip ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(single ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
          >
            {on && !single && <Icon name="check" size={14} />}
            {o.label}
            {o.count !== undefined && <span className="chip-count">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Panneau qui monte du bas de l'écran. Fermeture : ✕, fond, touche Échap. */
export function Sheet(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { title, onClose, children, footer } = props
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
      previous?.focus?.()
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function EmptyState(props: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={props.icon} size={34} />
      </div>
      <h2>{props.title}</h2>
      {props.children && <p>{props.children}</p>}
      {props.action}
    </div>
  )
}

export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="tablist" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === props.value}
          className={o.value === props.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toaster() {
  const list = useSyncExternalStore(subscribeToasts, getToasts)
  return (
    <div className="toaster" aria-live="polite" role="status">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function PageHeader(props: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
        <h1>{props.title}</h1>
      </div>
      {props.action}
    </header>
  )
}
