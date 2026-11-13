/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { RELEASE_NOTES } from './src/releaseNotes.ts'

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
    // 新しい版のリリースノートを release-notes.json として書き出す。
    // おしらせ(src/update/UpdateProvider.tsx)は、新しい版を見つけたときに配信先のこれを読み、
    // 更新する前に変更点を見せる(新しい版のノートは、今動いている古い版の中には無いため)。
    {
      name: 'mojifuru-release-notes',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'release-notes.json',
          source: JSON.stringify({ notes: RELEASE_NOTES }),
        })
      },
    },
    VitePWA({
      // 'autoUpdate'は新バージョンをバックグラウンドで無言適用するため反映まで時間がかかる。
      // 'prompt'にしてSWの登録・更新確認をアプリ側(src/update/UpdateProvider.tsx)で明示的に制御し、
      // 新しい版はおしらせ(風鈴)で知らせて、ユーザがすきなときに更新できるようにする。
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
        // src/index.cssの --bg / --chrome-color と統一。
        // theme_colorはiOS PWAでステータスバーの帯を塗る色になるため、
        // アプリの地色(--chrome-color = .app-shellの背景)と必ず同じにすること。
        background_color: '#fff8f0',
        theme_color: '#fffdf9',
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
        // navigateFallback(既定値'index.html')はnavigateFallbackDenylist未設定だと
        // 拡張子付きパスへの直接アクセス(例: /sitemap.xml, /robots.txt)まで
        // SPAフォールバックとしてindex.htmlにすり替えてしまう(過去の実バグ)。
        // アプリのルートは拡張子を持たないため、拡張子付きパスのみ除外すれば十分。
        navigateFallbackDenylist: [/\.[^/?]+$/],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
})
