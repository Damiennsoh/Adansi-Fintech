import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_'],
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true
      },
      includeAssets: ['icons/icon-192x192.png', 'icons/icon-512x512.png', 'manifest.json'],
      manifest: {
        name: 'Adansi - Collective Finance',
        short_name: 'Adansi',
        description: 'The Collective Finance Protocol for Ghana',
        theme_color: '#FFC107',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', '.vercel.run']
  }
})
