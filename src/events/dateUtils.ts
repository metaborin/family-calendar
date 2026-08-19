/**
 * 日付・時刻のユーティリティ。
 *
 * 重要: UTC変換による日付ずれを避けるため、
 * `new Date("2026-08-05")` や `toISOString()` は使用しない。
 * （前者はUTC 0時と解釈され、日本時間では前日になり得る）
 * 日付キーは必ずローカルの年・月・日から組み立てる。
 */

/** "HH:MM"（24時間表記）の形式か */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "YYYY-MM-DD" の形式か（ゼロ埋め必須） */
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * ローカルの年・月・日から "YYYY-MM-DD" を作る。
 * month は 1〜12。
 */
export function toDateKey(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0')
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "YYYY-MM-DD" を分解する。形式または実在しない日付なら null */
export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const m = DATE_KEY_PATTERN.exec(key)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12) return null
  // その月に実在する日か（2月30日などを弾く）
  const lastDay = new Date(year, month, 0).getDate()
  if (day < 1 || day > lastDay) return null
  return { year, month, day }
}

export function isValidDateKey(key: unknown): key is string {
  return typeof key === 'string' && parseDateKey(key) !== null
}

/**
 * ローカル日付としての曜日（0=日曜 〜 6=土曜）。
 * new Date(year, monthIndex, day) はローカル時刻で解釈されるためズレない。
 */
export function getWeekday(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay()
}

/** 今日の "YYYY-MM-DD"（ローカル） */
export function todayDateKey(): string {
  const now = new Date()
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * 日付キーの前後比較。
 * ゼロ埋めされた "YYYY-MM-DD" どうしなら辞書順比較で日付順と一致する。
 */
export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** "HH:MM"（24時間表記）か */
export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

/** 時刻を分に直す（並べ替え用）。不正な値は null */
export function timeToMinutes(time: string | null): number | null {
  if (!isValidTime(time)) return null
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * 予定の時刻表示。
 *   開始・終了あり → "15:30–16:30"
 *   開始のみ       → "15:30"
 *   時刻なし       → ""
 */
export function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime) return ''
  if (!endTime) return startTime
  return `${startTime}–${endTime}`
}

/** "2026-08-11" → "2026年8月11日" */
export function formatDateKeyJa(key: string): string {
  const parsed = parseDateKey(key)
  if (!parsed) return key
  return `${parsed.year}年${parsed.month}月${parsed.day}日`
}

/** "2026-08-01" → "2026/08/01" */
export function formatDateKeySlash(key: string): string {
  const parsed = parseDateKey(key)
  if (!parsed) return key
  return `${parsed.year}/${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}`
}

/**
 * 一意なID。
 * crypto.randomUUID() が使えない環境（古いブラウザ・非セキュアコンテキスト）向けに
 * フォールバックを用意する。
 */
export function createId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID()
    } catch {
      /* フォールバックへ */
    }
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
