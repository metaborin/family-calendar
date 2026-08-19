import type { ColumnId } from '../types'
import { toMonthKey } from '../calendar'
import type {
  CellItem,
  TimedEvent,
  TimedEventStore,
  WeeklyRecurringRule,
} from './types'
import { getWeekday, timeToMinutes, toDateKey } from './dateUtils'

/**
 * 定期予定は各月のデータへコピーせず、ここでルールから発生日を計算する。
 * そのため、ルールを直せば全該当日へ即座に反映され、
 * 削除すれば全該当日から消え、自由入力データを汚さない。
 */

/** 表示中の月における、日付→列ID→定期予定 の対応 */
export type RecurringOccurrences = Map<number, Map<ColumnId, WeeklyRecurringRule[]>>

/** そのルールが、指定日に表示されるべきか */
export function occursOn(rule: WeeklyRecurringRule, year: number, month: number, day: number): boolean {
  if (!rule.enabled) return false
  if (getWeekday(year, month, day) !== rule.weekday) return false

  const dateKey = toDateKey(year, month, day)
  // 開始日を含み、それ以降
  if (dateKey < rule.startDate) return false
  // 終了日がある場合は終了日を含み、それ以前
  if (rule.endDate !== null && dateKey > rule.endDate) return false
  // 「この日だけ休み」に入っていない
  if (rule.excludedDates.includes(dateKey)) return false

  return true
}

/** 表示中の年月について、全ルールの発生日を求める */
export function getMonthOccurrences(
  rules: WeeklyRecurringRule[],
  year: number,
  month: number,
  dayCount: number,
): RecurringOccurrences {
  const result: RecurringOccurrences = new Map()

  for (let day = 1; day <= dayCount; day++) {
    let byColumn: Map<ColumnId, WeeklyRecurringRule[]> | null = null

    for (const rule of rules) {
      if (!occursOn(rule, year, month, day)) continue
      if (byColumn === null) {
        byColumn = new Map()
        result.set(day, byColumn)
      }
      const list = byColumn.get(rule.columnId)
      if (list) list.push(rule)
      else byColumn.set(rule.columnId, [rule])
    }
  }

  return result
}

/**
 * 1セル分の表示項目を、開始時間順に並べて返す。
 *
 * 並び順:
 *   1. 開始時間が設定された予定を時刻順
 *   2. 開始時間がない予定
 *   同じ時刻・同じ条件なら、日付指定予定 → 定期予定 の順で、
 *   それぞれ保存されている順番を維持する（安定ソート）。
 * 自由入力メモは、この一覧の後ろに別途表示する。
 */
export function buildCellItems(
  timedEvents: TimedEvent[] | undefined,
  recurringRules: WeeklyRecurringRule[] | undefined,
  dateKey: string,
): CellItem[] {
  const items: CellItem[] = []

  for (const event of timedEvents ?? []) {
    items.push({ kind: 'timed', event })
  }
  for (const rule of recurringRules ?? []) {
    items.push({ kind: 'recurring', rule, dateKey })
  }

  if (items.length < 2) return items

  const startOf = (item: CellItem): string | null =>
    item.kind === 'timed' ? item.event.startTime : item.rule.startTime

  // 元の並びを覚えておき、同点のときの順序を安定させる
  const order = new Map(items.map((item, index) => [item, index]))

  return items.sort((a, b) => {
    const ma = timeToMinutes(startOf(a))
    const mb = timeToMinutes(startOf(b))

    // 時刻ありを先に、時刻なしを後ろに
    if (ma === null && mb !== null) return 1
    if (ma !== null && mb === null) return -1
    if (ma !== null && mb !== null && ma !== mb) return ma - mb

    // 同時刻（または両方時刻なし）なら、日付指定予定を先に
    if (a.kind !== b.kind) return a.kind === 'timed' ? -1 : 1

    // それでも同じなら保存順を維持
    return (order.get(a) ?? 0) - (order.get(b) ?? 0)
  })
}

/** 指定の場所にある時間付き予定を取り出す */
export function getTimedEventsAt(
  store: TimedEventStore,
  year: number,
  month: number,
  day: number,
  columnId: ColumnId,
): TimedEvent[] | undefined {
  return store[toMonthKey(year, month)]?.[String(day)]?.[columnId]
}
