/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages(https://<user>.github.io/mojifuru/)でのプロジェクトページ配信を想定
  base: '/mojifuru/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
