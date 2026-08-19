import { COLUMN_IDS, type ColumnId, type FamilyNames, type MonthSchedule } from './types'
import type { CalendarDay } from './calendar'
import CellEventList, { CellEventPrintList } from './events/CellEventList'
import type { CellItem, TimedEvent, WeeklyRecurringRule } from './events/types'

type Props = {
  days: CalendarDay[]
  names: FamilyNames
  monthSchedule: MonthSchedule
  onCellChange: (day: number, columnId: ColumnId, value: string) => void
  /** その日・その列に表示する予定（時間付き＋定期予定を時刻順に並べたもの） */
  getCellItems: (day: number, columnId: ColumnId) => CellItem[]
  onAddEvent: (day: number, columnId: ColumnId) => void
  onSelectTimedEvent: (day: number, columnId: ColumnId, event: TimedEvent) => void
  onSelectRecurring: (rule: WeeklyRecurringRule, dateKey: string) => void
}

/** 曜日に応じた行のクラス名（土＝薄い水色 / 日＝薄いピンク / 平日＝白） */
function rowClass(weekday: number): string {
  if (weekday === 0) return 'row row--sunday'
  if (weekday === 6) return 'row row--saturday'
  return 'row'
}

export default function CalendarTable({
  days,
  names,
  monthSchedule,
  onCellChange,
  getCellItems,
  onAddEvent,
  onSelectTimedEvent,
  onSelectRecurring,
}: Props) {
  return (
    <table className="calendar-table">
      <colgroup>
        <col className="col-date-left" />
        <col className="col-everyone" />
        <col className="col-member" />
        <col className="col-member" />
        <col className="col-member" />
        <col className="col-member" />
        <col className="col-member" />
        <col className="col-date-right" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className="head-date">
            日付
          </th>
          {COLUMN_IDS.map((id) => (
            <th scope="col" key={id} className="head-name">
              {names[id]}
            </th>
          ))}
          <th scope="col" className="head-date">
            日付
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map(({ day, weekday, weekdayLabel }) => {
          const daySchedule = monthSchedule[String(day)]
          return (
            <tr key={day} className={rowClass(weekday)}>
              <th scope="row" className="date-left">
                <span className="date-left__num">{day}</span>
                <span className="date-left__wday">{weekdayLabel}</span>
              </th>

              {COLUMN_IDS.map((id) => {
                const value = daySchedule?.[id] ?? ''
                const items = getCellItems(day, id)
                const cellLabel = `${day}日 ${names[id]}`
                return (
                  <td key={id} className="cell">
                    <button
                      type="button"
                      className="ev-add-button no-print"
                      aria-label={`${cellLabel}に予定を追加`}
                      onClick={() => onAddEvent(day, id)}
                    >
                      ＋
                    </button>

                    {/* 1. 時間付き予定 → 2. 定期予定（画面用） */}
                    <CellEventList
                      items={items}
                      cellLabel={cellLabel}
                      onSelectTimedEvent={(event) => onSelectTimedEvent(day, id, event)}
                      onSelectRecurring={onSelectRecurring}
                    />

                    {/* 3. 自由入力メモ（画面入力用） */}
                    <textarea
                      className="cell__input"
                      value={value}
                      aria-label={`${cellLabel} 自由入力メモ`}
                      onChange={(e) => onCellChange(day, id, e.target.value)}
                    />

                    {/*
                      印刷用のまとまり（画面では非表示）。
                      印刷時はこの箱をセル内へ絶対配置し、行の高さを
                      押し広げないようにしている（A4縦1ページを保つため）。
                      並びは 1.時間付き予定 → 2.定期予定 → 3.自由入力メモ。
                    */}
                    <div className="cell__print-area" aria-hidden="true">
                      <CellEventPrintList items={items} />
                      <div className="cell__print">{value}</div>
                    </div>
                  </td>
                )
              })}

              <td className="date-right">{day}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
