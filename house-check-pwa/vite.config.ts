import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
  VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'House Scanner',
        short_name: 'HouseScanner',
        description: 'AI-powered house analysis tool for scanning and analyzing properties',
        theme_color: '#22c55e',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // sensible defaults; you can tweak later
        navigateFallback: '/index.html',
      },
      // Enable SW in dev to let you test PWA behavior with `npm run dev`.
      // Remove or set enabled:false later if you prefer prod-only SW.
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      }
    })
  ],
});
