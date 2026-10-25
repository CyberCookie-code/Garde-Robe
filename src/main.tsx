import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Police embarquée (mise en cache par le service worker) : l'app reste lisible hors ligne.
import '@fontsource-variable/geist/wght.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
