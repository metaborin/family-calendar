import type { CSSProperties } from 'react'
import { COLUMN_IDS, type ColumnId, type FamilyNames, type MonthSchedule } from './types'
import type { CalendarDay } from './calendar'
import CellEventList, { CellEventPrintList } from './events/CellEventList'
import type { CellItem, TimedEvent, WeeklyRecurringRule } from './events/types'
import { RangeBandLayer, RangeLabelList, RangePrintLabels } from './range/RangeBands'
import type { DateRangeEvent, RangeSegment } from './range/types'

type Props = {
  days: CalendarDay[]
  names: FamilyNames
  monthSchedule: MonthSchedule
  onCellChange: (day: number, columnId: ColumnId, value: string) => void
  /** その日・その列に表示する予定（時間付き＋定期予定を時刻順に並べたもの） */
  getCellItems: (day: number, columnId: ColumnId) => CellItem[]
  /** その日・その列に描く期間予定の帯（レーン順） */
  getRangeSegments: (day: number, columnId: ColumnId) => RangeSegment[]
  /** 列ごとの帯の余白（--range-gutter / --range-gutter-print） */
  rangeGutterStyles: Record<ColumnId, CSSProperties | undefined>
  onAddEvent: (day: number, columnId: ColumnId) => void
  onSelectTimedEvent: (day: number, columnId: ColumnId, event: TimedEvent) => void
  onSelectRecurring: (rule: WeeklyRecurringRule, dateKey: string) => void
  onSelectRangeEvent: (event: DateRangeEvent) => void
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
  getRangeSegments,
  rangeGutterStyles,
  onAddEvent,
  onSelectTimedEvent,
  onSelectRecurring,
  onSelectRangeEvent,
}: Props) {
  return (
    <table className="calendar-table">
      {/* 7列（日付＋予定6列）。予定6列はすべて同じ幅にする */}
      <colgroup>
        <col className="col-date-left" />
        <col className="col-schedule" />
        <col className="col-schedule" />
        <col className="col-schedule" />
        <col className="col-schedule" />
        <col className="col-schedule" />
        <col className="col-schedule" />
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
        </tr>
      </thead>
      <tbody>
        {days.map(({ day, weekday, weekdayLabel }) => {
          const daySchedule = monthSchedule[String(day)]
          return (
            <tr key={day} className={rowClass(weekday)}>
              {/* 日付と曜日は同じ行に、セルの縦横中央へ表示する */}
              <th scope="row" className="date-cell">
                <span className="date-cell__content">
                  <span className="date-cell__number">{day}</span>
                  <span className="date-cell__weekday">{weekdayLabel}</span>
                </span>
              </th>

              {COLUMN_IDS.map((id) => {
                const value = daySchedule?.[id] ?? ''
                const items = getCellItems(day, id)
                const segments = getRangeSegments(day, id)
                const cellLabel = `${day}日 ${names[id]}`
                return (
                  <td key={id} className="cell" style={rangeGutterStyles[id]}>
                    {/*
                      1. 期間予定の帯（絶対配置。行の高さも既存の表示位置も動かさない）
                         画面・印刷の両方に出る。
                    */}
                    <RangeBandLayer
                      segments={segments}
                      targetName={names[id]}
                      onSelect={onSelectRangeEvent}
                    />

                    <button
                      type="button"
                      className="ev-add-button no-print"
                      aria-label={`${cellLabel}に予定を追加`}
                      onClick={() => onAddEvent(day, id)}
                    >
                      ＋
                    </button>

                    {/* 期間予定の予定名（最初に見える日だけ1行使う・画面用） */}
                    <RangeLabelList
                      segments={segments}
                      targetName={names[id]}
                      onSelect={onSelectRangeEvent}
                    />

                    {/* 2. 時間付き予定 → 3. 定期予定（画面用） */}
                    <CellEventList
                      items={items}
                      cellLabel={cellLabel}
                      onSelectTimedEvent={(event) => onSelectTimedEvent(day, id, event)}
                      onSelectRecurring={onSelectRecurring}
                    />

                    {/* 4. 自由入力メモ（画面入力用） */}
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
                      並びは 1.期間予定の予定名 → 2.時間付き予定 → 3.定期予定 → 4.自由入力メモ。
                      期間予定の縦帯は、この箱の外側（セル直下）へ絶対配置している。
                    */}
                    <div className="cell__print-area" aria-hidden="true">
                      <RangePrintLabels segments={segments} />
                      <CellEventPrintList items={items} />
                      <div className="cell__print">{value}</div>
                    </div>
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
