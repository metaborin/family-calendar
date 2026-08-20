import type { FamilyNames, ScheduleStore } from '../types'
import type { TimedEventStore, WeeklyRecurringRule } from '../events/types'
import type { DateRangeEvent } from '../range/types'

/** バックアップに含める5種類のデータ（localStorageの5キーと1対1で対応する） */
export type BackupData = {
  names: FamilyNames
  schedules: ScheduleStore
  timedEvents: TimedEventStore
  recurringRules: WeeklyRecurringRule[]
  /** 期間予定（schemaVersion 2 で追加） */
  rangeEvents: DateRangeEvent[]
}

/** このアプリのバックアップであることを示す固定値 */
export const BACKUP_APP_ID = 'family-calendar'

/**
 * 新しく作成するバックアップの形式。
 *   1 … 家族名・自由入力メモ・時間付き予定・定期予定（期間予定なし）
 *   2 … 上記に期間予定（rangeEvents）を加えたもの
 */
export const BACKUP_SCHEMA_VERSION = 2

/** 復元できる最も古い形式 */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1

/** 対応しているバックアップ形式の版 */
export type BackupSchemaVersion = 1 | 2

/**
 * バックアップファイルの中身（schemaVersion: 2）。
 *
 * 予定データ以外は入れない。
 * Cookie・PWAキャッシュ・ブラウザ情報・公開URL・端末のパスなどは含めない。
 */
export type FamilyCalendarBackupV2 = {
  appId: typeof BACKUP_APP_ID
  schemaVersion: 2
  /** ISO 8601（例: 2026-08-20T11:30:45.123Z） */
  exportedAt: string
  data: BackupData
}

/** これまでに作成されたバックアップ（schemaVersion: 1）。復元だけ対応する */
export type FamilyCalendarBackupV1 = {
  appId: typeof BACKUP_APP_ID
  schemaVersion: 1
  exportedAt: string
  data: Omit<BackupData, 'rangeEvents'>
}

/** 復元前にユーザーへ見せる概要 */
export type BackupSummary = {
  /** ファイルに書かれていた形式の版 */
  schemaVersion: BackupSchemaVersion
  /** 期間予定を含まない旧形式（schemaVersion 1）か */
  isLegacyFormat: boolean
  /** 表示用の作成日時（例: 2026年8月20日 20:30）。読めない場合は null */
  exportedAtLabel: string | null
  /** 家族名の件数（固定6件） */
  nameCount: number
  /** 自由入力メモの件数（空文字は数えない） */
  scheduleCount: number
  /** 時間付き予定の件数 */
  timedEventCount: number
  /** 定期予定の件数 */
  recurringRuleCount: number
  /** 「この日だけ休み」にした日の合計件数 */
  excludedDateCount: number
  /** 期間予定の件数（旧形式では 0） */
  rangeEventCount: number
  /**
   * データが存在する最古の年月（"YYYY-MM"）。無い場合は null。
   * 自由入力メモ・時間付き予定に加え、定期予定の開始日・終了日・
   * 「この日だけ休み」の日付、期間予定の開始日・終了日も含めて求める。
   */
  firstMonth: string | null
  /**
   * データが存在する最新の年月（"YYYY-MM"）。無い場合は null。
   * 終了日なしの定期予定がある場合、この値は「判明している範囲」の最新であり、
   * 表示上は hasOpenEndedRecurring を優先して「終了日なし」と示す。
   */
  lastMonth: string | null
  /** 終了日なし（endDate: null）の定期予定が1件以上あるか */
  hasOpenEndedRecurring: boolean
}

/**
 * 検証結果。失敗時はデータを一切変更しない。
 *
 * 成功時の data は、旧形式（schemaVersion 1）なら rangeEvents: [] を補った
 * 現在の形へそろえてある。復元はこの data をそのまま全置換で使う。
 */
export type ValidationResult =
  | { ok: true; data: BackupData; summary: BackupSummary }
  | { ok: false; error: string }
