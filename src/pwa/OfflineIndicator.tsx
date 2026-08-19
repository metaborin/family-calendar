import { useEffect, useState } from 'react'

/**
 * オフライン中だけ小さく「オフライン」と表示する。
 * オンラインへ戻れば自動的に消える。大きな警告は出さない。
 */
export default function OfflineIndicator() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <span className="pwa-offline no-print" role="status">
      オフライン
    </span>
  )
}
