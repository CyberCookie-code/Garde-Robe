import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices embarquées (sous-ensemble latin) : l'app reste lisible hors ligne.
import '@fontsource/public-sans/latin-400.css'
import '@fontsource/public-sans/latin-500.css'
import '@fontsource/public-sans/latin-600.css'
import '@fontsource/libre-bodoni/latin-400.css'
import '@fontsource/libre-bodoni/latin-400-italic.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
