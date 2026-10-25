import { useEffect, useState } from 'react'
import { ensureProfile } from './data/db'
import { requestPersistence } from './data/backup'
import { Icon, type IconName } from './components/icons'
import { Toaster } from './components/ui'
import { TodayPage } from './pages/TodayPage'
import { WardrobePage } from './pages/WardrobePage'
import { OutfitsPage } from './pages/OutfitsPage'
import { SettingsPage } from './pages/SettingsPage'

export type Tab = 'today' | 'wardrobe' | 'outfits' | 'settings'
/** Action à ouvrir en arrivant sur un onglet (ex. bouton « Ajouter un vêtement » d'un état vide). */
export type Intent = 'add-item' | 'new-outfit' | undefined
export type Go = (tab: Tab, intent?: Intent) => void

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: 'today' },
  { id: 'wardrobe', label: 'Garde-robe', icon: 'hanger' },
  { id: 'outfits', label: 'Tenues', icon: 'layers' },
  { id: 'settings', label: 'Réglages', icon: 'settings' },
]

export default function App() {
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [intent, setIntent] = useState<Intent>()

  useEffect(() => {
    // La migration éventuelle de la base (v3 : profil unique) s'exécute à la première ouverture.
    void ensureProfile().then(() => setReady(true))
    void requestPersistence()
  }, [])

  const go: Go = (t, i) => {
    setTab(t)
    setIntent(i)
    window.scrollTo({ top: 0 })
  }

  if (!ready) return null

  return (
    <div className="app">
      <main id="contenu">
        {tab === 'today' && <TodayPage go={go} />}
        {tab === 'wardrobe' && <WardrobePage intent={intent} clearIntent={() => setIntent(undefined)} />}
        {tab === 'outfits' && <OutfitsPage go={go} intent={intent} clearIntent={() => setIntent(undefined)} />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      <nav className="tabs" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'on' : ''}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={24} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>
      <Toaster />
    </div>
  )
}

