import { useEffect, useId, useRef, type ReactNode } from 'react'

type Props = {
  title: string
  /** 背景クリックで閉じてよいか（入力途中は確認を挟むため false にできる） */
  onClose: () => void
  children: ReactNode
  /** フッターのボタン類 */
  footer?: ReactNode
  /** 幅の広いダイアログ（定期予定一覧など） */
  wide?: boolean
}

/** フォーカスを閉じ込める対象 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 予定用のモーダルダイアログ共通部分。
 *
 * - role="dialog" / aria-modal="true" / 見出しと関連付け
 * - Escで閉じる
 * - 閉じるボタンあり
 * - 背景クリックで閉じる（内側のクリックでは閉じない）
 * - 開いたら最初の入力欄へフォーカス、閉じたら元のボタンへ戻す
 * - Tabでダイアログ内を循環する
 * - 印刷されない（no-print）
 * - iPhoneのSafe Areaを考慮し、内容が多い場合はダイアログ内だけスクロールする
 */
export default function Dialog({ title, onClose, children, footer, wide }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  // 開いた時点のフォーカス元を覚えておく
  useEffect(() => {
    openerRef.current = document.activeElement
    return () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  // 開いたら最初の入力欄（無ければダイアログ自体）へフォーカス
  useEffect(() => {
    const root = dialogRef.current
    if (!root) return
    const first = root.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )
    ;(first ?? root).focus()
  }, [])

  // Esc で閉じる / Tab をダイアログ内で循環させる
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const root = dialogRef.current
      if (!root) return
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      className="ev-backdrop no-print"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={wide ? 'ev-dialog ev-dialog--wide' : 'ev-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="ev-dialog__header">
          <h2 className="ev-dialog__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="ev-dialog__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="ev-dialog__body">{children}</div>

        {footer && <div className="ev-dialog__footer">{footer}</div>}
      </div>
    </div>
  )
}
