import type { ColumnId } from '../types'

/**
 * 時間付き予定・毎週の定期予定の型定義。
 *
 * 既存の型（DaySchedule / MonthSchedule / ScheduleStore）は変更していない。
 * 自由入力メモは従来どおり `family-calendar-mvp:schedules` にのみ保存し、
 * ここで扱うデータは別のlocalStorageキーへ保存する。
 * そのため既存データの移行処理は不要。
 */

/** 日付を指定して追加した予定（1件） */
export type TimedEvent = {
  id: string
  title: string
  /** "HH:MM"（24時間表記）。時刻なしの場合は null */
  startTime: string | null
  /** "HH:MM"。任意。開始時刻が null のときは必ず null */
  endTime: string | null
}

/** 1日分の時間付き予定（列ID → 予定の配列） */
export type TimedEventDay = Partial<Record<ColumnId, TimedEvent[]>>

/** 1か月分（"1" 〜 "31" の日付文字列 → 1日分） */
export type TimedEventMonth = Record<string, TimedEventDay>

/**
 * 全期間の時間付き予定。キーは "YYYY-MM"。
 *
 * 例:
 * {
 *   "2026-08": {
 *     "5": { "member1": [{ id: "...", title: "病院", startTime: "09:30", endTime: "10:30" }] }
 *   }
 * }
 */
export type TimedEventStore = Record<string, TimedEventMonth>

/** 曜日（0=日曜 〜 6=土曜） */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * 毎週の定期予定ルール。
 *
 * 発生日は各月のデータへコピーせず、表示のたびにこのルールから計算する。
 * そのため、ルールを直せば全該当日へ即座に反映される。
 */
export type WeeklyRecurringRule = {
  id: string
  columnId: ColumnId
  title: string
  /** 1ルールにつき曜日は1つ。複数曜日はルールを分けて登録する */
  weekday: Weekday
  startTime: string | null
  endTime: string | null
  /** "YYYY-MM-DD"（必須） */
  startDate: string
  /** "YYYY-MM-DD"。null は終了日なし（無期限） */
  endDate: string | null
  /** false のあいだはカレンダーへ表示しない（データは残す） */
  enabled: boolean
  /** 「この日だけ休み」にした日（"YYYY-MM-DD" の配列） */
  excludedDates: string[]
}

/** セルへ表示する1件分。時間付き予定と定期予定を同じ並びで扱う */
export type CellItem =
  | { kind: 'timed'; event: TimedEvent }
  | { kind: 'recurring'; rule: WeeklyRecurringRule; dateKey: string }

/** 予定編集ダイアログが扱う値 */
export type TimedEventDraft = {
  /** 既存予定の編集なら元のid、新規なら null */
  id: string | null
  /** 元の場所（編集時に日付・対象が変わったら移動するために使う） */
  originalDateKey: string | null
  originalColumnId: ColumnId | null
  dateKey: string
  columnId: ColumnId
  title: string
  startTime: string
  endTime: string
}

/** 定期予定編集ダイアログが扱う値 */
export type RecurringRuleDraft = {
  id: string | null
  columnId: ColumnId
  title: string
  weekday: Weekday
  startTime: string
  endTime: string
  startDate: string
  endDate: string
  enabled: boolean
  excludedDates: string[]
}
