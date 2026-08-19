import { useState } from 'react'

type Props = {
  year: number
  month: number
  /** 月別イラストのURL（装飾） */
  illustration: string
}

/**
 * カレンダー上部の月ヘッダー。
 *
 * 左にタイトルと年月、右に月別イラストを置く。
 * イラストは装飾なので `alt=""` ＋ `aria-hidden` で読み上げ対象にしない。
 * 読み込みに失敗した場合は、壊れた画像アイコンを出さずに非表示にする。
 */
export default function MonthHeader({ year, month, illustration }: Props) {
  /*
   * 読み込みに失敗したイラストのURLを覚えておく。
   * 真偽値ではなくURLで持つことで、月が変わって別のイラストになれば
   * 自動的にやり直しになる（状態のリセット処理が要らない）。
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = failedSrc === illustration

  return (
    <div className="month-header">
      <div className="month-header__text">
        {/* 画面上で唯一の可視タイトル（ページの h1） */}
        <h1 className="month-header__app">家族カレンダー</h1>
        <p className="month-header__date">
          {year}年 {month}月
        </p>
      </div>

      {!failed && (
        <img
          className="month-header__illustration"
          src={illustration}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setFailedSrc(illustration)}
        />
      )}
    </div>
  )
}
