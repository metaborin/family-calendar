import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

/**
 * PWA用アイコンの生成設定。
 *
 * 元画像: public/family-calendar-icon.svg（オリジナル。第三者素材は不使用）
 *
 * minimal-2023 プリセットで次を生成する。
 *   - pwa-64x64.png / pwa-192x192.png / pwa-512x512.png （purpose: any）
 *   - maskable-icon-512x512.png （purpose: maskable / 安全領域のため余白を付ける）
 *   - apple-touch-icon-180x180.png （iPhone・iPad のホーム画面用）
 *   - favicon.ico
 *
 * 生成コマンド: npm run generate:pwa-assets
 */
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: minimal2023Preset,
  images: ['public/family-calendar-icon.svg'],
})
