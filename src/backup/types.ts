import type { FamilyNames, ScheduleStore } from '../types'
import type { TimedEventStore, WeeklyRecurringRule } from '../events/types'

/** バックアップに含める4種類のデータ（localStorageの4キーと1対1で対応する） */
export type BackupData = {
  names: FamilyNames
  schedules: ScheduleStore
  timedEvents: TimedEventStore
  recurringRules: WeeklyRecurringRule[]
}

/** このアプリのバックアップであることを示す固定値 */
export const BACKUP_APP_ID = 'family-calendar'

/** 現在のバックアップ形式の版。形式を変えるときに増やす */
export const BACKUP_SCHEMA_VERSION = 1

/**
 * バックアップファイルの中身（schemaVersion: 1）。
 *
 * 予定データ以外は入れない。
 * Cookie・PWAキャッシュ・ブラウザ情報・公開URL・端末のパスなどは含めない。
 */
export type FamilyCalendarBackupV1 = {
  appId: typeof BACKUP_APP_ID
  schemaVersion: 1
  /** ISO 8601（例: 2026-08-20T11:30:45.123Z） */
  exportedAt: string
  data: BackupData
}

/** 復元前にユーザーへ見せる概要 */
export type BackupSummary = {
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
  /**
   * データが存在する最古の年月（"YYYY-MM"）。無い場合は null。
   * 自由入力メモ・時間付き予定に加え、定期予定の開始日・終了日・
   * 「この日だけ休み」の日付も含めて求める。
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

/** 検証結果。失敗時はデータを一切変更しない */
export type ValidationResult =
  | { ok: true; backup: FamilyCalendarBackupV1; summary: BackupSummary }
  | { ok: false; error: string }
