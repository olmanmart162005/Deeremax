import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'DeereMax',
        short_name: 'DeereMax',
        description: 'Sistema Empresarial de Reportes Agrícolas DeereMax.',
        theme_color: '#166534',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-icons/icon-16x16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-32x32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-48x48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-180x180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-256x256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
