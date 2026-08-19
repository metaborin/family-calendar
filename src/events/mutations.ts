import type { ColumnId } from '../types'
import type {
  RecurringRuleDraft,
  TimedEvent,
  TimedEventDraft,
  TimedEventStore,
  WeeklyRecurringRule,
} from './types'
import { createId, parseDateKey } from './dateUtils'

/** "YYYY-MM-DD" → { monthKey: "YYYY-MM", dayKey: "5" } */
function splitDateKey(dateKey: string): { monthKey: string; dayKey: string } | null {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null
  return {
    monthKey: `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}`,
    dayKey: String(parsed.day),
  }
}

/** 指定の場所から1件取り除いた新しいストアを返す（元は変更しない） */
export function removeTimedEvent(
  store: TimedEventStore,
  dateKey: string,
  columnId: ColumnId,
  eventId: string,
): TimedEventStore {
  const at = splitDateKey(dateKey)
  if (!at) return store
  const month = store[at.monthKey]
  const day = month?.[at.dayKey]
  const list = day?.[columnId]
  if (!month || !day || !list) return store

  const nextList = list.filter((e) => e.id !== eventId)

  const nextDay = { ...day }
  if (nextList.length > 0) nextDay[columnId] = nextList
  else delete nextDay[columnId]

  const nextMonth = { ...month }
  if (Object.keys(nextDay).length > 0) nextMonth[at.dayKey] = nextDay
  else delete nextMonth[at.dayKey]

  const next = { ...store }
  if (Object.keys(nextMonth).length > 0) next[at.monthKey] = nextMonth
  else delete next[at.monthKey]

  return next
}

/** 指定の場所へ1件追加した新しいストアを返す（元は変更しない） */
export function addTimedEvent(
  store: TimedEventStore,
  dateKey: string,
  columnId: ColumnId,
  event: TimedEvent,
): TimedEventStore {
  const at = splitDateKey(dateKey)
  if (!at) return store

  const month = store[at.monthKey] ?? {}
  const day = month[at.dayKey] ?? {}
  const list = day[columnId] ?? []

  return {
    ...store,
    [at.monthKey]: {
      ...month,
      [at.dayKey]: { ...day, [columnId]: [...list, event] },
    },
  }
}

/**
 * 予定編集ダイアログの内容を保存する。
 * 日付や対象が変わっていた場合は、元の場所から取り除いて新しい場所へ移す。
 */
export function applyTimedEventDraft(
  store: TimedEventStore,
  draft: TimedEventDraft,
): TimedEventStore {
  let next = store

  if (draft.id !== null && draft.originalDateKey !== null && draft.originalColumnId !== null) {
    next = removeTimedEvent(next, draft.originalDateKey, draft.originalColumnId, draft.id)
  }

  const startTime = draft.startTime === '' ? null : draft.startTime
  const event: TimedEvent = {
    id: draft.id ?? createId(),
    title: draft.title.trim(),
    startTime,
    // 開始時間が空なら終了時間も必ず空にする
    endTime: startTime === null || draft.endTime === '' ? null : draft.endTime,
  }

  return addTimedEvent(next, draft.dateKey, draft.columnId, event)
}

/** 定期予定ルールの追加・更新 */
export function applyRecurringRuleDraft(
  rules: WeeklyRecurringRule[],
  draft: RecurringRuleDraft,
): WeeklyRecurringRule[] {
  const startTime = draft.startTime === '' ? null : draft.startTime
  const rule: WeeklyRecurringRule = {
    id: draft.id ?? createId(),
    columnId: draft.columnId,
    title: draft.title.trim(),
    weekday: draft.weekday,
    startTime,
    endTime: startTime === null || draft.endTime === '' ? null : draft.endTime,
    startDate: draft.startDate,
    endDate: draft.endDate === '' ? null : draft.endDate,
    enabled: draft.enabled,
    excludedDates: Array.from(new Set(draft.excludedDates)).sort(),
  }

  if (draft.id === null) return [...rules, rule]
  return rules.map((r) => (r.id === draft.id ? rule : r))
}

/** 「この日だけ休みにする」 */
export function addExcludedDate(
  rules: WeeklyRecurringRule[],
  ruleId: string,
  dateKey: string,
): WeeklyRecurringRule[] {
  return rules.map((rule) => {
    if (rule.id !== ruleId) return rule
    if (rule.excludedDates.includes(dateKey)) return rule
    return { ...rule, excludedDates: [...rule.excludedDates, dateKey].sort() }
  })
}

/** 有効・無効の切り替え（ルールは削除しない） */
export function toggleRuleEnabled(
  rules: WeeklyRecurringRule[],
  ruleId: string,
): WeeklyRecurringRule[] {
  return rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
}

export function removeRule(rules: WeeklyRecurringRule[], ruleId: string): WeeklyRecurringRule[] {
  return rules.filter((rule) => rule.id !== ruleId)
}
