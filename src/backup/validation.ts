import { COLUMN_IDS, type ColumnId, type FamilyNames, type ScheduleStore } from '../types'
import type { TimedEventStore, WeeklyRecurringRule } from '../events/types'
import type { DateRangeEvent } from '../range/types'
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  MIN_SUPPORTED_SCHEMA_VERSION,
  type BackupData,
  type BackupSchemaVersion,
  type BackupSummary,
  type ValidationResult,
} from './types'

/**
 * バックアップファイルの厳格な検証。
 *
 * 方針：壊れた項目を黙って捨てて続行しない。
 * 1つでも復元不能な問題があれば、その時点で中止して理由を返す。
 * （読み込み時の storage.ts とは方針が異なる。あちらは既存データを守るため寛容にする）
 */

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/
const DAY_KEY = /^([1-9]|[12]\d|3[01])$/
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 上限10MB。これを超えるファイルは読み込まない */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isColumnId = (v: unknown): v is ColumnId =>
  typeof v === 'string' && (COLUMN_IDS as readonly string[]).includes(v)

/** 実在する日付か（2月30日などを弾く） */
function isRealDate(key: string): boolean {
  const m = DATE_KEY.exec(key)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12) return false
  const last = new Date(y, mo, 0).getDate()
  return d >= 1 && d <= last
}

/** 年月キーと日付キーの組み合わせが実在するか */
function dayExistsInMonth(monthKey: string, dayKey: string): boolean {
  const m = MONTH_KEY.exec(monthKey)
  if (!m) return false
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate()
  const day = Number(dayKey)
  return day >= 1 && day <= last
}

/** null または "HH:MM" */
const isTimeOrNull = (v: unknown): v is string | null =>
  v === null || (typeof v === 'string' && TIME.test(v))

class Invalid extends Error {}

/**
 * 検証を中止する。
 * 呼び出し後にコードが続かないことをTypeScriptへ伝えるため、
 * アロー関数ではなく関数宣言にしている（never による絞り込みが効く）。
 */
function fail(message: string): never {
  throw new Invalid(message)
}

// ---------- 各データの検証 ----------

function checkNames(raw: unknown): void {
  if (!isRecord(raw)) fail('家族名のデータが壊れています。')
  const keys = Object.keys(raw)
  for (const id of COLUMN_IDS) {
    if (!(id in raw)) fail(`家族名のデータに「${id}」がありません。`)
    if (typeof raw[id] !== 'string') fail(`家族名「${id}」が文字列ではありません。`)
  }
  const unknown = keys.filter((k) => !(COLUMN_IDS as readonly string[]).includes(k))
  if (unknown.length > 0) fail(`家族名のデータに不明な項目があります（${unknown[0]}）。`)
}

function checkSchedules(raw: unknown): number {
  if (!isRecord(raw)) fail('自由入力メモのデータが壊れています。')
  let count = 0
  for (const [monthKey, monthValue] of Object.entries(raw)) {
    if (!MONTH_KEY.test(monthKey)) fail(`自由入力メモの年月「${monthKey}」が正しくありません。`)
    if (!isRecord(monthValue)) fail(`自由入力メモ（${monthKey}）のデータが壊れています。`)

    for (const [dayKey, dayValue] of Object.entries(monthValue)) {
      if (!DAY_KEY.test(dayKey)) fail(`自由入力メモ（${monthKey}）の日付「${dayKey}」が正しくありません。`)
      if (!dayExistsInMonth(monthKey, dayKey)) {
        fail(`自由入力メモに存在しない日付があります（${monthKey}-${dayKey}）。`)
      }
      if (!isRecord(dayValue)) fail(`自由入力メモ（${monthKey}-${dayKey}）のデータが壊れています。`)

      for (const [columnId, text] of Object.entries(dayValue)) {
        if (!isColumnId(columnId)) {
          fail(`自由入力メモ（${monthKey}-${dayKey}）に不明な家族列があります（${columnId}）。`)
        }
        if (typeof text !== 'string') {
          fail(`自由入力メモ（${monthKey}-${dayKey}）の内容が文字列ではありません。`)
        }
        if (text !== '') count++
      }
    }
  }
  return count
}

function checkTimedEvents(raw: unknown): number {
  if (!isRecord(raw)) fail('時間付き予定のデータが壊れています。')
  const ids = new Set<string>()
  let count = 0

  for (const [monthKey, monthValue] of Object.entries(raw)) {
    if (!MONTH_KEY.test(monthKey)) fail(`時間付き予定の年月「${monthKey}」が正しくありません。`)
    if (!isRecord(monthValue)) fail(`時間付き予定（${monthKey}）のデータが壊れています。`)

    for (const [dayKey, dayValue] of Object.entries(monthValue)) {
      if (!DAY_KEY.test(dayKey)) fail(`時間付き予定（${monthKey}）の日付「${dayKey}」が正しくありません。`)
      if (!dayExistsInMonth(monthKey, dayKey)) {
        fail(`時間付き予定に存在しない日付があります（${monthKey}-${dayKey}）。`)
      }
      if (!isRecord(dayValue)) fail(`時間付き予定（${monthKey}-${dayKey}）のデータが壊れています。`)

      for (const [columnId, list] of Object.entries(dayValue)) {
        if (!isColumnId(columnId)) {
          fail(`時間付き予定（${monthKey}-${dayKey}）に不明な家族列があります（${columnId}）。`)
        }
        if (!Array.isArray(list)) fail(`時間付き予定（${monthKey}-${dayKey}）が配列ではありません。`)

        for (const item of list) {
          if (!isRecord(item)) fail(`時間付き予定（${monthKey}-${dayKey}）の項目が壊れています。`)
          if (typeof item.id !== 'string' || item.id === '') {
            fail(`時間付き予定（${monthKey}-${dayKey}）にIDがありません。`)
          }
          if (ids.has(item.id)) fail(`時間付き予定のIDが重複しています（${item.id}）。`)
          ids.add(item.id)

          if (typeof item.title !== 'string' || item.title.trim() === '') {
            fail(`時間付き予定（${monthKey}-${dayKey}）の予定名がありません。`)
          }
          if (!isTimeOrNull(item.startTime)) {
            fail(`時間付き予定「${item.title}」の開始時間が正しくありません。`)
          }
          if (!isTimeOrNull(item.endTime)) {
            fail(`時間付き予定「${item.title}」の終了時間が正しくありません。`)
          }
          if (item.startTime === null && item.endTime !== null) {
            fail(`時間付き予定「${item.title}」に開始時間がないのに終了時間があります。`)
          }
          if (
            typeof item.startTime === 'string' &&
            typeof item.endTime === 'string' &&
            item.endTime < item.startTime
          ) {
            fail(`時間付き予定「${item.title}」の終了時間が開始時間より前です。`)
          }
          count++
        }
      }
    }
  }
  return count
}

function checkRecurringRules(raw: unknown): { count: number; excludedCount: number } {
  if (!Array.isArray(raw)) fail('定期予定のデータが配列ではありません。')
  const ids = new Set<string>()
  let excludedCount = 0

  for (const rule of raw) {
    if (!isRecord(rule)) fail('定期予定の項目が壊れています。')

    if (typeof rule.id !== 'string' || rule.id === '') fail('定期予定にIDがありません。')
    if (ids.has(rule.id)) fail(`定期予定のIDが重複しています（${rule.id}）。`)
    ids.add(rule.id)

    if (!isColumnId(rule.columnId)) fail('定期予定に不明な家族列があります。')
    if (typeof rule.title !== 'string' || rule.title.trim() === '') {
      fail('定期予定の予定名がありません。')
    }
    if (
      typeof rule.weekday !== 'number' ||
      !Number.isInteger(rule.weekday) ||
      rule.weekday < 0 ||
      rule.weekday > 6
    ) {
      fail(`定期予定「${rule.title}」の曜日が正しくありません。`)
    }
    if (!isTimeOrNull(rule.startTime)) fail(`定期予定「${rule.title}」の開始時間が正しくありません。`)
    if (!isTimeOrNull(rule.endTime)) fail(`定期予定「${rule.title}」の終了時間が正しくありません。`)
    if (rule.startTime === null && rule.endTime !== null) {
      fail(`定期予定「${rule.title}」に開始時間がないのに終了時間があります。`)
    }
    if (
      typeof rule.startTime === 'string' &&
      typeof rule.endTime === 'string' &&
      rule.endTime < rule.startTime
    ) {
      fail(`定期予定「${rule.title}」の終了時間が開始時間より前です。`)
    }

    if (typeof rule.startDate !== 'string' || !isRealDate(rule.startDate)) {
      fail(`定期予定「${rule.title}」の開始日が正しくありません。`)
    }
    if (rule.endDate !== null) {
      if (typeof rule.endDate !== 'string' || !isRealDate(rule.endDate)) {
        fail(`定期予定「${rule.title}」の終了日が正しくありません。`)
      }
      if (rule.endDate < rule.startDate) {
        fail(`定期予定「${rule.title}」の終了日が開始日より前です。`)
      }
    }

    if (typeof rule.enabled !== 'boolean') {
      fail(`定期予定「${rule.title}」の有効・無効が正しくありません。`)
    }

    if (!Array.isArray(rule.excludedDates)) {
      fail(`定期予定「${rule.title}」の休みにした日が配列ではありません。`)
    }
    const seen = new Set<string>()
    for (const d of rule.excludedDates) {
      if (typeof d !== 'string' || !isRealDate(d)) {
        fail(`定期予定「${rule.title}」の休みにした日が正しくありません。`)
      }
      if (seen.has(d)) fail(`定期予定「${rule.title}」の休みにした日が重複しています（${d}）。`)
      seen.add(d)
    }
    excludedCount += rule.excludedDates.length
  }

  return { count: raw.length, excludedCount }
}

/**
 * 期間予定の検証（schemaVersion 2 以降のみ）。
 * 1件でも復元できない問題があれば、その時点で中止する。
 */
function checkRangeEvents(raw: unknown): number {
  if (!Array.isArray(raw)) fail('期間予定のデータが配列ではありません。')
  const ids = new Set<string>()

  for (const event of raw) {
    if (!isRecord(event)) fail('期間予定の項目が壊れています。')

    if (typeof event.id !== 'string' || event.id === '') fail('期間予定にIDがありません。')
    if (ids.has(event.id)) fail(`期間予定のIDが重複しています（${event.id}）。`)
    ids.add(event.id)

    if (!isColumnId(event.columnId)) fail('期間予定に不明な家族列があります。')
    if (typeof event.title !== 'string' || event.title.trim() === '') {
      fail('期間予定の予定名がありません。')
    }
    if (typeof event.startDate !== 'string' || !isRealDate(event.startDate)) {
      fail(`期間予定「${event.title}」の開始日が正しくありません。`)
    }
    if (typeof event.endDate !== 'string' || !isRealDate(event.endDate)) {
      fail(`期間予定「${event.title}」の終了日が正しくありません。`)
    }
    if (event.endDate < event.startDate) {
      fail(`期間予定「${event.title}」の終了日が開始日より前です。`)
    }
  }

  return raw.length
}

// ---------- 概要 ----------

function formatExportedAt(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "YYYY-MM-DD" → "YYYY-MM" */
const toMonth = (dateKey: string) => dateKey.slice(0, 7)

function buildSummary(
  version: BackupSchemaVersion,
  exportedAt: string,
  data: BackupData,
  counts: { schedules: number; timed: number; rules: number; excluded: number },
): BackupSummary {
  // 自由入力メモ・時間付き予定の年月
  const months = new Set<string>([
    ...Object.keys(data.schedules),
    ...Object.keys(data.timedEvents),
  ])

  /*
   * 定期予定も対象期間へ含める。
   * 定期予定しか無いバックアップで「予定なし」と出てしまわないようにするため、
   * 開始日・終了日・「この日だけ休み」の日付をすべて見る。
   * 無効化されている定期予定も、保存されているデータなので含める。
   */
  let hasOpenEndedRecurring = false
  for (const rule of data.recurringRules) {
    months.add(toMonth(rule.startDate))
    if (rule.endDate === null) hasOpenEndedRecurring = true
    else months.add(toMonth(rule.endDate))
    for (const d of rule.excludedDates) months.add(toMonth(d))
  }

  /*
   * 期間予定も対象期間へ含める。
   * 期間予定しか無いバックアップで「予定なし」と出さないため、
   * 開始日と終了日の両方を見る。
   */
  for (const event of data.rangeEvents) {
    months.add(toMonth(event.startDate))
    months.add(toMonth(event.endDate))
  }

  const sorted = [...months].sort()
  return {
    schemaVersion: version,
    isLegacyFormat: version < BACKUP_SCHEMA_VERSION,
    exportedAtLabel: formatExportedAt(exportedAt),
    nameCount: Object.keys(data.names).length,
    scheduleCount: counts.schedules,
    timedEventCount: counts.timed,
    recurringRuleCount: counts.rules,
    excludedDateCount: counts.excluded,
    rangeEventCount: data.rangeEvents.length,
    firstMonth: sorted[0] ?? null,
    lastMonth: sorted[sorted.length - 1] ?? null,
    hasOpenEndedRecurring,
  }
}

// ---------- 入口 ----------

/**
 * バックアップJSONの文字列を検証する。
 * 成功したときだけ復元してよい。失敗時は既存データを一切変更しないこと。
 *
 * schemaVersion 1（期間予定なし）も引き続き復元できる。
 * その場合 data.rangeEvents は空配列として扱い、全置換の対象に含める
 * （現在の端末にある期間予定はすべて消える。復元前に画面で警告する）。
 */
export function validateBackupText(text: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error:
        'ファイルの中身がJSONとして読み取れません。家族カレンダーのバックアップファイルを選んでください。',
    }
  }

  try {
    if (!isRecord(parsed)) fail('バックアップファイルの形式が正しくありません。')

    if (parsed.appId !== BACKUP_APP_ID) {
      fail('家族カレンダーのバックアップファイルではありません。')
    }

    const version = parsed.schemaVersion
    if (typeof version !== 'number' || !Number.isInteger(version)) {
      fail('このバックアップ形式には対応していません。')
    }
    if (version > BACKUP_SCHEMA_VERSION) {
      fail(
        'このバックアップは、現在のアプリより新しい形式で作成されています。アプリを最新版へ更新してからもう一度お試しください。',
      )
    }
    if (version < MIN_SUPPORTED_SCHEMA_VERSION) {
      fail('このバックアップ形式には対応していません。')
    }

    if (typeof parsed.exportedAt !== 'string' || Number.isNaN(new Date(parsed.exportedAt).getTime())) {
      fail('バックアップの作成日時が正しくありません。')
    }

    if (!isRecord(parsed.data)) fail('バックアップにデータが含まれていません。')
    const data = parsed.data
    for (const key of ['names', 'schedules', 'timedEvents', 'recurringRules'] as const) {
      if (!(key in data)) fail(`バックアップに「${key}」が含まれていません。`)
    }

    const isV2 = version >= 2
    if (isV2 && !('rangeEvents' in data)) {
      fail('バックアップに「rangeEvents」が含まれていません。')
    }
    /*
     * schemaVersion 1 には期間予定が存在しない。
     * それなのに rangeEvents が入っているファイルは、
     * 版と中身が食い違っているため復元しない（黙って捨てない）。
     */
    if (!isV2 && 'rangeEvents' in data) {
      fail('このバックアップは旧形式（schemaVersion 1）ですが、期間予定が含まれています。ファイルが壊れている可能性があります。')
    }

    checkNames(data.names)
    const scheduleCount = checkSchedules(data.schedules)
    const timedCount = checkTimedEvents(data.timedEvents)
    const rules = checkRecurringRules(data.recurringRules)
    if (isV2) checkRangeEvents(data.rangeEvents)

    // 旧形式でも、復元に使う形は現在の5種類へそろえる
    const normalized: BackupData = {
      names: data.names as FamilyNames,
      schedules: data.schedules as ScheduleStore,
      timedEvents: data.timedEvents as TimedEventStore,
      recurringRules: data.recurringRules as WeeklyRecurringRule[],
      rangeEvents: isV2 ? (data.rangeEvents as DateRangeEvent[]) : [],
    }

    return {
      ok: true,
      data: normalized,
      summary: buildSummary(version as BackupSchemaVersion, parsed.exportedAt, normalized, {
        schedules: scheduleCount,
        timed: timedCount,
        rules: rules.count,
        excluded: rules.excludedCount,
      }),
    }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message }
    return { ok: false, error: 'バックアップファイルを読み取れませんでした。' }
  }
}
