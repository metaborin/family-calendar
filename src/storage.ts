import {
  COLUMN_IDS,
  DEFAULT_NAMES,
  type FamilyNames,
  type ScheduleStore,
  type MonthSchedule,
  type DaySchedule,
} from './types'

/** 他アプリと衝突しにくいlocalStorageキー */
export const NAMES_KEY = 'family-calendar-mvp:names'
export const SCHEDULES_KEY = 'family-calendar-mvp:schedules'

export type LoadedState = {
  names: FamilyNames
  schedules: ScheduleStore
  /** 読み込みに失敗した場合の画面表示用メッセージ（正常時は null） */
  error: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 保存されていた家族名を、欠けや型崩れに耐える形で読み直す */
function parseNames(raw: unknown): FamilyNames {
  const names: FamilyNames = { ...DEFAULT_NAMES }
  if (!isRecord(raw)) return names
  for (const id of COLUMN_IDS) {
    const value = raw[id]
    if (typeof value === 'string' && value.trim() !== '') {
      names[id] = value
    }
  }
  return names
}

/** 保存されていた予定を、想定外の値を捨てながら読み直す */
function parseSchedules(raw: unknown): ScheduleStore {
  const store: ScheduleStore = {}
  if (!isRecord(raw)) return store

  for (const [monthKey, monthValue] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(monthKey) || !isRecord(monthValue)) continue

    const month: MonthSchedule = {}
    for (const [dayKey, dayValue] of Object.entries(monthValue)) {
      if (!/^\d{1,2}$/.test(dayKey) || !isRecord(dayValue)) continue

      const day: DaySchedule = {}
      for (const id of COLUMN_IDS) {
        const text = dayValue[id]
        if (typeof text === 'string' && text !== '') day[id] = text
      }
      if (Object.keys(day).length > 0) month[dayKey] = day
    }
    if (Object.keys(month).length > 0) store[monthKey] = month
  }
  return store
}

/**
 * localStorageから初期状態を読み込む。
 * JSON解析に失敗しても例外を投げず、初期値とエラーメッセージを返す
 * （アプリ全体が真っ白にならないようにするため）。
 */
export function loadInitialState(): LoadedState {
  let names: FamilyNames = { ...DEFAULT_NAMES }
  let schedules: ScheduleStore = {}
  const failed: string[] = []

  try {
    const raw = localStorage.getItem(NAMES_KEY)
    if (raw !== null) names = parseNames(JSON.parse(raw))
  } catch {
    failed.push('家族名')
  }

  try {
    const raw = localStorage.getItem(SCHEDULES_KEY)
    if (raw !== null) schedules = parseSchedules(JSON.parse(raw))
  } catch {
    failed.push('予定')
  }

  return {
    names,
    schedules,
    error:
      failed.length === 0
        ? null
        : `保存データ（${failed.join('・')}）を読み込めませんでした。初期値で起動しています。`,
  }
}

/** 保存に失敗した場合はエラーメッセージを返す（成功時は null） */
export function saveNames(names: FamilyNames): string | null {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names))
    return null
  } catch {
    return '家族名を保存できませんでした。ブラウザの保存容量や設定をご確認ください。'
  }
}

/** 保存に失敗した場合はエラーメッセージを返す（成功時は null） */
export function saveSchedules(schedules: ScheduleStore): string | null {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules))
    return null
  } catch {
    return '予定を保存できませんでした。ブラウザの保存容量や設定をご確認ください。'
  }
}
