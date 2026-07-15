import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['planet-mark.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '字游星球 - 小学识字探险',
        short_name: '字游星球',
        description: '本地优先、循证设计的小学识字训练应用',
        theme_color: '#fff8ea',
        background_color: '#fff8ea',
        display: 'standalone',
        start_url: '/',
        id: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ]
});
