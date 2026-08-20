import { COLUMN_IDS, type ColumnId } from '../types'
import { createId, isValidDateKey } from '../events/dateUtils'
import type { DateRangeEvent } from './types'

/**
 * 期間予定だけを保存する新しいlocalStorageキー。
 *
 * 既存の4キー
 *   family-calendar-mvp:names
 *   family-calendar-mvp:schedules
 *   family-calendar-mvp:timed-events
 *   family-calendar-mvp:recurring-rules
 * は変更しない。期間予定を自由入力メモや時間付き予定へ複製もしない。
 */
export const RANGE_EVENTS_KEY = 'family-calendar-mvp:range-events'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === 'string' && (COLUMN_IDS as readonly string[]).includes(value)
}

/**
 * 保存済みの期間予定を、壊れた項目だけ無視しながら読み直す。
 * 例外は投げない（アプリ全体が真っ白にならないようにするため）。
 */
export function parseRangeEvents(raw: unknown): { events: DateRangeEvent[]; dropped: number } {
  const events: DateRangeEvent[] = []
  let dropped = 0
  if (!Array.isArray(raw)) return { events, dropped: raw === null || raw === undefined ? 0 : 1 }

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
    if (!isValidDateKey(item.startDate) || !isValidDateKey(item.endDate)) {
      dropped++
      continue
    }
    // 開始日・終了日はどちらも必須なので、前後が逆の項目は直しようがない
    if (item.endDate < item.startDate) {
      dropped++
      continue
    }

    // IDが無い・重複している場合は振り直す（予定そのものは失わない）
    let id = typeof item.id === 'string' && item.id !== '' ? item.id : createId()
    if (usedIds.has(id)) id = createId()
    usedIds.add(id)

    events.push({
      id,
      columnId: item.columnId,
      title,
      startDate: item.startDate,
      endDate: item.endDate,
    })
  }

  return { events, dropped }
}

export type LoadedRangeState = {
  rangeEvents: DateRangeEvent[]
  /** 読み込みに問題があった場合の画面表示用メッセージ（正常時は null） */
  error: string | null
}

export function loadRangeEvents(): LoadedRangeState {
  try {
    const raw = localStorage.getItem(RANGE_EVENTS_KEY)
    if (raw === null) return { rangeEvents: [], error: null }
    const parsed = parseRangeEvents(JSON.parse(raw))
    return {
      rangeEvents: parsed.events,
      error:
        parsed.dropped > 0
          ? `期間予定の一部（${parsed.dropped}件）が読み取れなかったため、その分を除いて表示しています。`
          : null,
    }
  } catch {
    return {
      rangeEvents: [],
      error: '保存データ（期間予定）を読み込めませんでした。該当分は空の状態で起動しています。',
    }
  }
}

/** 保存に失敗した場合はエラーメッセージを返す（成功時は null） */
export function saveRangeEvents(events: DateRangeEvent[]): string | null {
  try {
    localStorage.setItem(RANGE_EVENTS_KEY, JSON.stringify(events))
    return null
  } catch {
    return '期間予定を保存できませんでした。ブラウザの保存容量や設定をご確認ください。'
  }
}
