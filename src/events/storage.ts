import { COLUMN_IDS, type ColumnId } from '../types'
import type {
  TimedEvent,
  TimedEventDay,
  TimedEventMonth,
  TimedEventStore,
  Weekday,
  WeeklyRecurringRule,
} from './types'
import { createId, isValidDateKey, isValidTime } from './dateUtils'

/**
 * 新しく追加したlocalStorageキー。
 * 既存の family-calendar-mvp:names / :schedules は変更しない。
 */
export const TIMED_EVENTS_KEY = 'family-calendar-mvp:timed-events'
export const RECURRING_RULES_KEY = 'family-calendar-mvp:recurring-rules'

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY_KEY_PATTERN = /^([1-9]|[12]\d|3[01])$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === 'string' && (COLUMN_IDS as readonly string[]).includes(value)
}

/**
 * 時刻の組を検証する。
 * 開始が無効なら、終了も落とす（開始が空なら終了も空、という仕様に合わせる）。
 */
function normalizeTimes(
  rawStart: unknown,
  rawEnd: unknown,
): { startTime: string | null; endTime: string | null } {
  const startTime = isValidTime(rawStart) ? rawStart : null
  if (startTime === null) return { startTime: null, endTime: null }
  const endTime = isValidTime(rawEnd) ? rawEnd : null
  // 終了が開始より前の壊れたデータは、終了だけ捨てて開始は残す
  if (endTime !== null && endTime < startTime) return { startTime, endTime: null }
  return { startTime, endTime }
}

/** 1件の時間付き予定を読み直す。使えない場合は null */
function parseTimedEvent(raw: unknown, usedIds: Set<string>): TimedEvent | null {
  if (!isRecord(raw)) return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (title === '') return null // 予定名が空のものは捨てる

  // IDが無い・重複している場合は振り直す（データは失わない）
  let id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : createId()
  if (usedIds.has(id)) id = createId()
  usedIds.add(id)

  const { startTime, endTime } = normalizeTimes(raw.startTime, raw.endTime)
  return { id, title, startTime, endTime }
}

/** 保存済みの時間付き予定を、壊れた項目だけ無視しながら読み直す */
function parseTimedEventStore(raw: unknown): { store: TimedEventStore; dropped: number } {
  const store: TimedEventStore = {}
  let dropped = 0
  if (!isRecord(raw)) return { store, dropped }

  const usedIds = new Set<string>()

  for (const [monthKey, monthValue] of Object.entries(raw)) {
    if (!MONTH_KEY_PATTERN.test(monthKey) || !isRecord(monthValue)) {
      dropped++
      continue
    }
    const month: TimedEventMonth = {}

    for (const [dayKey, dayValue] of Object.entries(monthValue)) {
      if (!DAY_KEY_PATTERN.test(dayKey) || !isRecord(dayValue)) {
        dropped++
        continue
      }
      const day: TimedEventDay = {}

      for (const columnId of COLUMN_IDS) {
        const list = dayValue[columnId]
        if (list === undefined) continue
        if (!Array.isArray(list)) {
          dropped++
          continue
        }
        const events: TimedEvent[] = []
        for (const item of list) {
          const parsed = parseTimedEvent(item, usedIds)
          if (parsed) events.push(parsed)
          else dropped++
        }
        if (events.length > 0) day[columnId] = events
      }

      if (Object.keys(day).length > 0) month[dayKey] = day
    }

    if (Object.keys(month).length > 0) store[monthKey] = month
  }

  return { store, dropped }
}

/** 保存済みの定期予定ルールを、壊れた項目だけ無視しながら読み直す */
function parseRecurringRules(raw: unknown): { rules: WeeklyRecurringRule[]; dropped: number } {
  const rules: WeeklyRecurringRule[] = []
  let dropped = 0
  if (!Array.isArray(raw)) return { rules, dropped: isRecord(raw) ? 1 : 0 }

  const usedIds = new Set<string>()

  for (const item of raw) {
    if (!isRecord(item)) {
      dropped++
      continue
    }

    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (title === '') {
      dropped++
      continue
    }
    if (!isColumnId(item.columnId)) {
      dropped++
      continue
    }
    const weekday = item.weekday
    if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      dropped++
      continue
    }
    if (!isValidDateKey(item.startDate)) {
      dropped++
      continue
    }

    // 終了日は無くてもよい。壊れていたら「終了日なし」として扱う
    const endDate = isValidDateKey(item.endDate) ? item.endDate : null
    // 終了日が開始日より前の壊れたデータは、終了日を捨てて残す
    const safeEndDate = endDate !== null && endDate < item.startDate ? null : endDate

    let id = typeof item.id === 'string' && item.id !== '' ? item.id : createId()
    if (usedIds.has(id)) id = createId()
    usedIds.add(id)

    const { startTime, endTime } = normalizeTimes(item.startTime, item.endTime)

    const excludedDates = Array.isArray(item.excludedDates)
      ? Array.from(new Set(item.excludedDates.filter(isValidDateKey))).sort()
      : []

    rules.push({
      id,
      columnId: item.columnId,
      title,
      weekday: weekday as Weekday,
      startTime,
      endTime,
      startDate: item.startDate,
      endDate: safeEndDate,
      enabled: item.enabled !== false, // 明示的な false 以外は有効扱い
      excludedDates,
    })
  }

  return { rules, dropped }
}

export type LoadedEventState = {
  timedEvents: TimedEventStore
  recurringRules: WeeklyRecurringRule[]
  /** 読み込みに問題があった場合の画面表示用メッセージ（正常時は null） */
  error: string | null
}

/**
 * localStorageから時間付き予定・定期予定を読み込む。
 * 例外は投げず、壊れた項目だけを無視して残りを返す
 * （アプリ全体が真っ白にならないようにするため）。
 */
export function loadEventState(): LoadedEventState {
  let timedEvents: TimedEventStore = {}
  let recurringRules: WeeklyRecurringRule[] = []
  const failed: string[] = []
  let droppedTotal = 0

  try {
    const raw = localStorage.getItem(TIMED_EVENTS_KEY)
    if (raw !== null) {
      const parsed = parseTimedEventStore(JSON.parse(raw))
      timedEvents = parsed.store
      droppedTotal += parsed.dropped
    }
  } catch {
    failed.push('時間付き予定')
  }

  try {
    const raw = localStorage.getItem(RECURRING_RULES_KEY)
    if (raw !== null) {
      const parsed = parseRecurringRules(JSON.parse(raw))
      recurringRules = parsed.rules
      droppedTotal += parsed.dropped
    }
  } catch {
    failed.push('定期予定')
  }

  let error: string | null = null
  if (failed.length > 0) {
    error = `保存データ（${failed.join('・')}）を読み込めませんでした。該当分は空の状態で起動しています。`
  } else if (droppedTotal > 0) {
    error = `保存データの一部（${droppedTotal}件）が読み取れなかったため、その分を除いて表示しています。`
  }

  return { timedEvents, recurringRules, error }
}

/** 保存に失敗した場合はエラーメッセージを返す（成功時は null） */
export function saveTimedEvents(store: TimedEventStore): string | null {
  try {
    localStorage.setItem(TIMED_EVENTS_KEY, JSON.stringify(store))
    return null
  } catch {
    return '時間付き予定を保存できませんでした。ブラウザの保存容量や設定をご確認ください。'
  }
}

/** 保存に失敗した場合はエラーメッセージを返す（成功時は null） */
export function saveRecurringRules(rules: WeeklyRecurringRule[]): string | null {
  try {
    localStorage.setItem(RECURRING_RULES_KEY, JSON.stringify(rules))
    return null
  } catch {
    return '定期予定を保存できませんでした。ブラウザの保存容量や設定をご確認ください。'
  }
}
