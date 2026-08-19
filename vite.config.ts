import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages のプロジェクトサイト（https://metaborin.github.io/family-calendar/）で
  // CSS・JavaScript が 404 にならないようにするための設定。
  // 開発サーバーでも同じパス（http://localhost:5173/family-calendar/）になる。
  // localStorage はパスではなくオリジン単位で保存されるため、
  // このパス変更で既存のローカル保存データが消えることはない。
  base: '/family-calendar/',
  plugins: [react()],
  server: {
    // start-app.cmd が開くURLと必ず一致させるため、ポートを固定する
    port: 5173,
    strictPort: true,
  },
})
