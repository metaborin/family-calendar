import { WEEKDAY_LABELS } from './types'

export const MIN_YEAR = 1900
export const MAX_YEAR = 2999

export type CalendarDay = {
  /** 1 〜 月末 */
  day: number
  /** 0=日曜 〜 6=土曜 */
  weekday: number
  /** 日本語1文字の曜日 */
  weekdayLabel: string
}

/** 年月キー "YYYY-MM"（例: 2026年8月 → "2026-08"） */
export function toMonthKey(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/**
 * その月の日数。
 * Date(year, month, 0) は「month月の0日」＝前月の末日になるため、
 * 28日・29日・30日・31日の月とうるう年へ自動的に対応する。
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** 1日から月末までの配列を生成する */
export function buildMonthDays(year: number, month: number): CalendarDay[] {
  const count = getDaysInMonth(year, month)
  const days: CalendarDay[] = []
  for (let day = 1; day <= count; day++) {
    const weekday = new Date(year, month - 1, day).getDay()
    days.push({ day, weekday, weekdayLabel: WEEKDAY_LABELS[weekday] })
  }
  return days
}

/** 年をまたぐ移動に対応した月送り（step は -1 または +1） */
export function shiftMonth(
  year: number,
  month: number,
  step: number,
): { year: number; month: number } {
  const zeroBased = (year * 12 + (month - 1)) + step
  return {
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  }
}

export function clampYear(year: number): number {
  if (!Number.isFinite(year)) return new Date().getFullYear()
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.trunc(year)))
}

export function clampMonth(month: number): number {
  if (!Number.isFinite(month)) return 1
  return Math.min(12, Math.max(1, Math.trunc(month)))
}
