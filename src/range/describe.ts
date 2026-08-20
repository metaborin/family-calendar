import { formatDateKeyJa, parseDateKey } from '../events/dateUtils'
import type { DateRangeEvent, RangeSegment } from './types'

/**
 * 期間予定の文字表現。
 * 画面・印刷・読み上げのどれからも使えるよう、コンポーネントから切り離してある。
 */

/**
 * 読み上げ用の説明。
 * 例：「夏季保育、2026年8月3日から2026年8月7日、家族1」
 */
export function describeRangeEvent(event: DateRangeEvent, targetName: string): string {
  return `${event.title}、${formatDateKeyJa(event.startDate)}から${formatDateKeyJa(event.endDate)}、${targetName}`
}

/** 帯・ラベルのアクセシブルな名前（前月から・翌月へも伝える） */
export function describeSegment(segment: RangeSegment, targetName: string): string {
  const parts = [describeRangeEvent(segment.event, targetName)]
  if (segment.continuesFromPrevMonth) parts.push('前月から続いています')
  if (segment.continuesToNextMonth) parts.push('翌月へ続きます')
  return parts.join('、')
}

/**
 * 一覧用の期間表示。
 *   同じ日          → 2026年8月10日
 *   同じ年・同じ月  → 2026年8月3日〜7日
 *   同じ年          → 2026年8月3日〜9月4日
 *   年をまたぐ      → 2026年12月29日〜2027年1月3日
 */
export function formatRangeLabel(startDate: string, endDate: string): string {
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!start || !end) return `${startDate}〜${endDate}`

  if (startDate === endDate) return formatDateKeyJa(startDate)
  if (start.year !== end.year) return `${formatDateKeyJa(startDate)}〜${formatDateKeyJa(endDate)}`
  if (start.month !== end.month) {
    return `${formatDateKeyJa(startDate)}〜${end.month}月${end.day}日`
  }
  return `${formatDateKeyJa(startDate)}〜${end.day}日`
}

/** 日数（開始日と終了日を含む） */
export function rangeDayLength(startDate: string, endDate: string): number {
  const s = parseDateKey(startDate)
  const e = parseDateKey(endDate)
  if (!s || !e) return 1
  // ローカル日付どうしの差なのでUTC変換は挟まない
  const from = new Date(s.year, s.month - 1, s.day)
  const to = new Date(e.year, e.month - 1, e.day)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
}
