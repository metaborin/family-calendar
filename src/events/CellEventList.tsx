import type { CellItem, TimedEvent, WeeklyRecurringRule } from './types'
import { formatTimeRange } from './dateUtils'

type Props = {
  items: CellItem[]
  /** 読み上げ用（「5日 家族1」など） */
  cellLabel: string
  onSelectTimedEvent: (event: TimedEvent) => void
  onSelectRecurring: (rule: WeeklyRecurringRule, dateKey: string) => void
}

/**
 * セル内の予定一覧（画面用）。
 *
 * 印刷用の表示は CellEventPrintList が担当する。
 * 画面ではボタンとして押せるようにし、印刷ではただのテキストにする。
 */
export default function CellEventList({
  items,
  cellLabel,
  onSelectTimedEvent,
  onSelectRecurring,
}: Props) {
  if (items.length === 0) return null

  return (
    <ul className="ev-cell-list no-print">
      {items.map((item) => {
        if (item.kind === 'timed') {
          const time = formatTimeRange(item.event.startTime, item.event.endTime)
          return (
            <li key={`t-${item.event.id}`}>
              <button
                type="button"
                className="ev-chip"
                onClick={() => onSelectTimedEvent(item.event)}
                aria-label={`${cellLabel} ${time ? time + ' ' : ''}${item.event.title} を編集`}
              >
                {time && <span className="ev-chip__time">{time}</span>}
                <span className="ev-chip__title">{item.event.title}</span>
              </button>
            </li>
          )
        }

        const time = formatTimeRange(item.rule.startTime, item.rule.endTime)
        return (
          <li key={`r-${item.rule.id}-${item.dateKey}`}>
            <button
              type="button"
              className="ev-chip ev-chip--recurring"
              onClick={() => onSelectRecurring(item.rule, item.dateKey)}
              aria-label={`${cellLabel} 毎週の予定 ${time ? time + ' ' : ''}${item.rule.title}`}
            >
              {time && <span className="ev-chip__time">{time}</span>}
              <span className="ev-chip__title">{item.rule.title}</span>
              <span className="ev-chip__repeat" aria-hidden="true">
                ↻
              </span>
              <span className="ev-visually-hidden">（毎週）</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * セル内の予定一覧（印刷用）。
 * 繰り返し記号やボタンは出さず、時刻と予定名だけを並べる。
 */
export function CellEventPrintList({ items }: { items: CellItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="ev-print-list" aria-hidden="true">
      {items.map((item) => {
        const time =
          item.kind === 'timed'
            ? formatTimeRange(item.event.startTime, item.event.endTime)
            : formatTimeRange(item.rule.startTime, item.rule.endTime)
        const title = item.kind === 'timed' ? item.event.title : item.rule.title
        const key = item.kind === 'timed' ? `t-${item.event.id}` : `r-${item.rule.id}-${item.dateKey}`
        return (
          <div className="ev-print-item" key={key}>
            {time && <span className="ev-print-item__time">{time}</span>}
            <span className="ev-print-item__title">{title}</span>
          </div>
        )
      })}
    </div>
  )
}
