import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** 「オフラインでも使えるようになりました」を自動で閉じるまでの時間 */
const OFFLINE_READY_AUTO_HIDE_MS = 6000

/**
 * Service Worker の更新案内。
 *
 * 入力中に勝手に再読み込みしないよう、registerType は 'prompt'。
 * 「更新する」を押したときだけ Service Worker を更新して再読み込みする。
 */
export default function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // 「オフラインでも使えるようになりました」は一度だけ表示し、自動で消す
  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_READY_AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (needRefresh) {
    return (
      <div className="pwa-toast no-print" role="alert" aria-live="assertive">
        <p className="pwa-toast__text">新しいバージョンがあります。</p>
        <div className="pwa-toast__actions">
          <button
            type="button"
            className="pwa-toast__button pwa-toast__button--primary"
            onClick={() => void updateServiceWorker(true)}
          >
            更新する
          </button>
          <button
            type="button"
            className="pwa-toast__button"
            onClick={() => setNeedRefresh(false)}
          >
            後で
          </button>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="pwa-toast no-print" role="status" aria-live="polite">
        <p className="pwa-toast__text">オフラインでも使えるようになりました。</p>
        <div className="pwa-toast__actions">
          <button
            type="button"
            className="pwa-toast__button"
            onClick={() => setOfflineReady(false)}
          >
            閉じる
          </button>
        </div>
      </div>
    )
  }

  return null
}
