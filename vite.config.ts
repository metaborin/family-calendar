import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のプロジェクトサイトのパス。manifest の id / start_url / scope と合わせる。
const BASE = '/family-calendar/'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages のプロジェクトサイト（https://metaborin.github.io/family-calendar/）で
  // CSS・JavaScript が 404 にならないようにするための設定。
  // 開発サーバーでも同じパス（http://localhost:5173/family-calendar/）になる。
  // localStorage はパスではなくオリジン単位で保存されるため、
  // このパス変更で既存のローカル保存データが消えることはない。
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // 入力中に勝手に再読み込みしないよう、更新はユーザーが押したときだけ行う
      registerType: 'prompt',
      injectRegister: null,

      // 開発サーバーでは Service Worker を有効にしない
      // （PWAの確認は npm run preview または公開版で行う）
      devOptions: {
        enabled: false,
      },

      manifest: {
        id: BASE,
        name: '家族カレンダー',
        short_name: '家族カレンダー',
        description: '家族の予定を入力し、1か月分をA4縦1ページへ印刷できるカレンダー',
        lang: 'ja-JP',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#0288d1',
        prefer_related_applications: false,
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          // maskable は any と分けて登録する
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      strategies: 'generateSW',
      workbox: {
        // アプリ本体（HTML / JS / CSS / アイコン / manifest）を事前キャッシュする
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // 古いキャッシュを整理する
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // 更新はユーザーが「更新する」を押したときだけ適用する
        skipWaiting: false,
        // GitHub Pages のサブパス配下で、どのURLでもアプリの index.html を返す
        navigateFallback: `${BASE}index.html`,
        // 外部サイトを不要にキャッシュしないよう、追加の runtimeCaching は設定しない
      },
    }),
  ],
  server: {
    // start-app.cmd が開くURLと必ず一致させるため、ポートを固定する
    port: 5173,
    strictPort: true,
  },
})
