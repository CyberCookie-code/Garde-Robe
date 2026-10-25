import { useEffect, useState, type ReactNode } from 'react'
import type { Item } from '../domain/types'

export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function ItemThumb({ item, size = 'md' }: { item: Item; size?: 'sm' | 'md' }) {
  const url = useBlobUrl(item.photo)
  return (
    <div className={`thumb thumb-${size}`} title={item.name}>
      {url ? (
        <img src={url} alt={item.name} />
      ) : (
        <div className="thumb-placeholder" style={{ background: item.colors[0]?.hex ?? '#ccc' }}>
          {item.name.slice(0, 2)}
        </div>
      )}
    </div>
  )
}

export function Chips<T extends string>(props: {
  options: { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
  single?: boolean
}) {
  const { options, value, onChange, single } = props
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            type="button"
            key={o.value}
            className={`chip ${on ? 'on' : ''}`}
            onClick={() =>
              onChange(single ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
