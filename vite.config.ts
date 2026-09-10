/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages(https://<user>.github.io/mojifuru/)ではリポジトリ名配下、
  // Cloudflare Pages(ビルド時に自動セットされるCF_PAGES環境変数で判定)ではルート配下に配信されるため、
  // ビルド環境に応じてbaseを切り替える。
  base: process.env.CF_PAGES ? '/' : '/mojifuru/',
  // ホーム画面フッターにバージョン表示するため、package.jsonのversionをビルド時に埋め込む
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate'は新バージョンをバックグラウンドで無言適用するため反映まで時間がかかる。
      // 'prompt'にしてSWの登録・更新確認をアプリ側(UpdateNotice)で明示的に制御し、
      // ユーザが能動的に「今すぐ更新」できるようにする。
      registerType: 'prompt',
      injectRegister: false,
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
