/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages(https://<user>.github.io/mojifuru/)でのプロジェクトページ配信を想定
  base: '/mojifuru/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-96.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'もじふる',
        short_name: 'もじふる',
        description: '上から降ってくるひらがなをタップして単語を作る早押し単語ゲーム',
        lang: 'ja',
        display: 'standalone',
        orientation: 'portrait',
        // src/index.cssの --bg / --color-orange-strong と統一
        background_color: '#fff8f0',
        theme_color: '#ff9838',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // dict.dawg / wordlist.json はビルド生成物で標準拡張子外・数MB規模のため明示的に対象化
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,dawg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
})
