import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // '/' en local ; '/<dépôt>/' sur GitHub Pages (voir .github/workflows/deploy.yml)
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // Moteur et modèle de détourage : trop lourds pour être préchargés, gardés au premier usage.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\.(wasm|onnx)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'detourage', expiration: { maxEntries: 4 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
      manifest: {
        name: 'Je mets quoi ?',
        short_name: 'Je mets quoi',
        description: 'Notre garde-robe et la tenue du jour',
        lang: 'fr',
        theme_color: '#ece7e1',
        background_color: '#ece7e1',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
