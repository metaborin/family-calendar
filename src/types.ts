/**
 * 家族カレンダー 最小構成版 の型定義
 *
 * 予定データは「表示名」ではなく固定の列ID（ColumnId）で管理する。
 * そのため家族名を変更しても、入力済みの予定は消えず、別の列へも移動しない。
 */

/** 表の予定列（固定6列・順序も固定） */
export const COLUMN_IDS = [
  'everyone',
  'member1',
  'member2',
  'member3',
  'member4',
  'member5',
] as const

export type ColumnId = (typeof COLUMN_IDS)[number]

/** 列IDごとの表示名（画面上部から変更でき、localStorageへ保存される） */
export type FamilyNames = Record<ColumnId, string>

/** 1日分の予定（列ID → 入力文字列） */
export type DaySchedule = Partial<Record<ColumnId, string>>

/** 1か月分の予定（"1" 〜 "31" の日付文字列 → 1日分の予定） */
export type MonthSchedule = Record<string, DaySchedule>

/**
 * 全期間の予定。
 * キーは "YYYY-MM" 形式の年月キー（例: "2026-08"）。
 *
 * 例:
 * {
 *   "2026-08": {
 *     "1": { "everyone": "買い物", "member1": "仕事" }
 *   }
 * }
 */
export type ScheduleStore = Record<string, MonthSchedule>

/** 初期表示名 */
export const DEFAULT_NAMES: FamilyNames = {
  everyone: 'みんなの予定',
  member1: '家族1',
  member2: '家族2',
  member3: '家族3',
  member4: '家族4',
  member5: '家族5',
}

/** 曜日（0=日曜 〜 6=土曜）を日本語1文字で表す */
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const
