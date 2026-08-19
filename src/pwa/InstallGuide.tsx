import { useCallback, useEffect, useId, useRef, useState } from 'react'

/**
 * Chromium系ブラウザだけが発火する beforeinstallprompt イベント。
 * 標準の型定義には無いため、必要な範囲だけ自前で定義する。
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

/** iOS Safari だけが持つ独自プロパティ（他ブラウザでは undefined） */
type SafariNavigator = Navigator & { standalone?: boolean }

/** すでにアプリとして起動しているか（インストール済みか）を安全に判定する */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const byDisplayMode = window.matchMedia?.('(display-mode: standalone)').matches === true
  const bySafari = (window.navigator as SafariNavigator).standalone === true
  return byDisplayMode || bySafari
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS はデスクトップ版Safariを名乗るため、タッチ対応のMacも iPad とみなす
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * 「アプリとして使う」ボタンと、その案内パネル。
 *
 * 画面の作りは変えず、操作部へ小さなボタンを1つ足すだけにしている。
 */
export default function InstallGuide() {
  const [open, setOpen] = useState(false)
  const [installed, setInstalled] = useState(detectStandalone)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos] = useState(detectIos)

  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  // beforeinstallprompt を保持しておき、ユーザーが押したときだけ prompt() を呼ぶ
  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setOpen(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  // 表示モードが standalone に変わったらインストール済みとして扱う
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)')
    if (!mq) return
    const onChange = () => setInstalled(detectStandalone())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    openerRef.current?.focus()
  }, [])

  // Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  // 開いたらパネルへフォーカスを移す
  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // prompt() は一度しか使えないので、押した後は必ず捨てる（何度も出さない）
    setDeferredPrompt(null)
    if (outcome === 'accepted') setInstalled(true)
    setOpen(false)
  }

  // すでにアプリとして起動している場合はボタンを出さない
  if (installed) return null

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        className="pwa-install-button no-print"
        onClick={() => setOpen(true)}
      >
        アプリとして使う
      </button>

      {open && (
        // 背景をクリックしたら閉じる（パネル内のクリックは閉じない）
        <div
          className="pwa-modal-backdrop no-print"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div
            className="pwa-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            ref={dialogRef}
          >
            <div className="pwa-modal__header">
              <h2 className="pwa-modal__title" id={titleId}>
                アプリとして使う
              </h2>
              <button
                type="button"
                className="pwa-modal__close"
                onClick={close}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <p className="pwa-modal__lead" id={descId}>
              ホーム画面やスタートメニューへ追加すると、アプリのように起動できます。
              インストールしなくても、このままブラウザで使えます。
            </p>

            {deferredPrompt && (
              <p className="pwa-modal__native">
                <button
                  type="button"
                  className="pwa-modal__install"
                  onClick={() => void handleNativeInstall()}
                >
                  このブラウザにインストールする
                </button>
              </p>
            )}

            {isIos && (
              <section className="pwa-modal__section">
                <h3 className="pwa-modal__subtitle">iPhone・iPad（Safari）</h3>
                <ol className="pwa-modal__steps">
                  <li>Safari でこのページを開く</li>
                  <li>画面下（iPadは画面上）の共有ボタン（□に↑）を押す</li>
                  <li>「ホーム画面に追加」を選ぶ</li>
                  <li>「Webアプリとして開く」に相当する設定が表示される場合は有効にする</li>
                  <li>「追加」を押す</li>
                </ol>
              </section>
            )}

            {!isIos && (
              <>
                <section className="pwa-modal__section">
                  <h3 className="pwa-modal__subtitle">Windows の Chrome・Edge</h3>
                  <ul className="pwa-modal__steps">
                    <li>アドレスバー右側のインストールアイコンを押す</li>
                    <li>または、ブラウザのメニューから「アプリをインストール」を選ぶ</li>
                  </ul>
                </section>

                <section className="pwa-modal__section">
                  <h3 className="pwa-modal__subtitle">Android の Chrome</h3>
                  <ul className="pwa-modal__steps">
                    <li>メニュー（右上の︙）を開く</li>
                    <li>「アプリをインストール」または「ホーム画面に追加」を選ぶ</li>
                  </ul>
                </section>

                <section className="pwa-modal__section">
                  <h3 className="pwa-modal__subtitle">iPhone・iPad（Safari）</h3>
                  <ol className="pwa-modal__steps">
                    <li>Safari でこのページを開く</li>
                    <li>共有ボタン（□に↑）を押す</li>
                    <li>「ホーム画面に追加」を選ぶ</li>
                    <li>「Webアプリとして開く」に相当する設定が表示される場合は有効にする</li>
                    <li>「追加」を押す</li>
                  </ol>
                </section>
              </>
            )}

            <p className="pwa-modal__note">
              予定は、この端末のこのアプリ内に保存されます。ほかの端末とは同期されません。
            </p>
            <p className="pwa-modal__note">
              iPhone・iPad では、Safari
              で入力済みの予定が、ホーム画面アプリへ自動コピーされない場合があります。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
