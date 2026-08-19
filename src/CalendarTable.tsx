import { COLUMN_IDS, type ColumnId, type FamilyNames, type MonthSchedule } from './types'
import type { CalendarDay } from './calendar'

type Props = {
  days: CalendarDay[]
  names: FamilyNames
  monthSchedule: MonthSchedule
  onCellChange: (day: number, columnId: ColumnId, value: string) => void
}

/** 曜日に応じた行のクラス名（土＝薄い水色 / 日＝薄いピンク / 平日＝白） */
function rowClass(weekday: number): string {
  if (weekday === 0) return 'row row--sunday'
  if (weekday === 6) return 'row row--saturday'
  return 'row'
}

export default function CalendarTable({ days, names, monthSchedule, onCellChange }: Props) {
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
                return (
                  <td key={id} className="cell">
                    {/* 画面入力用 */}
                    <textarea
                      className="cell__input"
                      value={value}
                      aria-label={`${day}日 ${names[id]}`}
                      onChange={(e) => onCellChange(day, id, e.target.value)}
                    />
                    {/* 印刷用（画面では非表示） */}
                    <div className="cell__print" aria-hidden="true">
                      {value}
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
