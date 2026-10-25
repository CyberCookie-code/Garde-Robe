import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ensureDefaultProfiles } from './data/db'
import { repo } from './data/repo'
import { TodayPage } from './pages/TodayPage'
import { WardrobePage } from './pages/WardrobePage'
import { OutfitsPage } from './pages/OutfitsPage'
import { SettingsPage } from './pages/SettingsPage'

type Tab = 'today' | 'wardrobe' | 'outfits' | 'settings'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: '☀️' },
  { id: 'wardrobe', label: 'Garde-robe', icon: '👕' },
  { id: 'outfits', label: 'Tenues', icon: '🧩' },
  { id: 'settings', label: 'Réglages', icon: '⚙️' },
]

const stored = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [profileId, setProfileId] = useState(stored('profile') ?? 'lui')
  const profiles = useLiveQuery(() => repo.profiles.list())
  const profile = profiles?.find((p) => p.id === profileId)

  useEffect(() => {
    void ensureDefaultProfiles().then(() => setReady(true))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('profile', profileId)
    } catch {
      /* navigation privée */
    }
    if (profile) document.documentElement.style.setProperty('--accent', profile.accent)
  }, [profileId, profile])

  if (!ready) return null

  return (
    <div className="app">
      <header className="top">
        <h1>Je mets quoi ?</h1>
        <div className="profiles" role="tablist">
          {profiles?.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === profileId}
              className={p.id === profileId ? 'on' : ''}
              style={{ ['--c' as string]: p.accent }}
              onClick={() => setProfileId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </header>

      <main>
        {tab === 'today' && <TodayPage profileId={profileId} />}
        {tab === 'wardrobe' && <WardrobePage profileId={profileId} />}
        {tab === 'outfits' && <OutfitsPage profileId={profileId} />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
