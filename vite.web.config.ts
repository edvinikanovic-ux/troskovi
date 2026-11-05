import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Browser / iPhone build (PWA) of the same UI. The Electron build is configured in electron.vite.config.ts.
export default defineConfig({
  root: resolve('web'),
  envDir: resolve('.'), // the same .env as the Mac app
  publicDir: resolve('web/public'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: 'Troskovi',
        short_name: 'Troskovi',
        description: 'Troškovi, računi, rate i krediti po mjesecima',
        lang: 'bs',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#f6f4ef',
        background_color: '#f6f4ef',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    fs: { allow: [resolve('.')] } // the UI lives in src/, outside the web/ root
  },
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true
  }
})
