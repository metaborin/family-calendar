import type { CSSProperties } from 'react'
import { describeSegment } from './describe'
import { RANGE_PALETTE } from './layout'
import type { DateRangeEvent, RangeSegment } from './types'

/**
 * セルの中へ描く期間予定の帯とラベル。
 *
 * 表のセルは rowspan で結合しない（行数・列数・自由入力欄・時間付き予定・
 * 定期予定をそのまま保つため）。日ごとに分けた帯を、上下の罫線をまたぐように
 * 少しはみ出して描くことで、目視では1本につながって見えるようにしている。
 *
 * 帯は絶対配置なので、行の高さも既存の文字表示の位置も動かさない。
 */

/** レーンと色をCSSへ渡す（横位置の計算は range.css 側で行う） */
function segmentStyle(segment: RangeSegment): CSSProperties {
  const palette = RANGE_PALETTE[segment.paletteIndex]
  return {
    '--lane': String(segment.lane),
    '--range-band': palette.band,
    '--range-soft': palette.soft,
    '--range-text': palette.text,
  } as CSSProperties
}

function bandClass(segment: RangeSegment): string {
  let className = 'range-band'
  if (segment.isStart) className += ' range-band--start'
  if (segment.isEnd) className += ' range-band--end'
  // 表示中の月で最後に見える日が終了日でない＝翌月へ続く
  if (segment.continuesToNextMonth && segment.isLastVisible) className += ' range-band--to-next'
  return className
}

type LayerProps = {
  segments: RangeSegment[]
  /** 対象の家族名（読み上げ用） */
  targetName: string
  onSelect: (event: DateRangeEvent) => void
}

/**
 * 帯そのもの（画面・印刷の両方に出る）と、
 * 押しやすくするための透明な領域（画面のみ）。
 */
export function RangeBandLayer({ segments, targetName, onSelect }: LayerProps) {
  if (segments.length === 0) return null

  return (
    <div className="range-layer">
      {segments.map((segment) => (
        <div
          key={`band-${segment.event.id}`}
          className={bandClass(segment)}
          style={segmentStyle(segment)}
          aria-hidden="true"
        />
      ))}

      {/*
        見た目の帯は4pxだが、それだけでは押しづらいため
        透明な領域を重ねて18px幅にしている（印刷はしない）。
        読み上げ・キーボード操作は予定名ラベル側が担当するので、
        ここはタブ順から外し、重複して読まれないようにする。
      */}
      {segments.map((segment) => (
        <button
          key={`hit-${segment.event.id}`}
          type="button"
          className="range-hit no-print"
          style={segmentStyle(segment)}
          tabIndex={-1}
          aria-hidden="true"
          title={describeSegment(segment, targetName)}
          onClick={() => onSelect(segment.event)}
        />
      ))}
    </div>
  )
}

type LabelProps = {
  segments: RangeSegment[]
  targetName: string
  onSelect: (event: DateRangeEvent) => void
}

/** 予定名ラベル（画面用）。表示中の月で最初に見える日にだけ出す */
export function RangeLabelList({ segments, targetName, onSelect }: LabelProps) {
  const labels = segments.filter((s) => s.isFirstVisible)
  if (labels.length === 0) return null

  return (
    <ul className="range-label-list no-print">
      {labels.map((segment) => (
        <li key={segment.event.id}>
          <button
            type="button"
            className="range-label"
            style={segmentStyle(segment)}
            aria-label={describeSegment(segment, targetName)}
            title={describeSegment(segment, targetName)}
            onClick={() => onSelect(segment.event)}
          >
            <span className="range-label__title">{segment.event.title}</span>
            {segment.continuesFromPrevMonth && (
              <span className="range-label__note">（前月から）</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** 予定名ラベル（印刷用）。ボタンにはせず、文字だけを出す */
export function RangePrintLabels({ segments }: { segments: RangeSegment[] }) {
  const labels = segments.filter((s) => s.isFirstVisible)
  if (labels.length === 0) return null

  return (
    <div className="range-print-labels" aria-hidden="true">
      {labels.map((segment) => (
        <div className="range-print-label" key={segment.event.id} style={segmentStyle(segment)}>
          <span className="range-print-label__title">{segment.event.title}</span>
          {segment.continuesFromPrevMonth && (
            <span className="range-print-label__note">（前月から）</span>
          )}
        </div>
      ))}
    </div>
  )
}
