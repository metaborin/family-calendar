import { NAMES_KEY, SCHEDULES_KEY } from '../storage'
import { RECURRING_RULES_KEY, TIMED_EVENTS_KEY } from '../events/storage'
import type { BackupData } from './types'

/**
 * バックアップの内容で localStorage の4キーをまとめて置き換える。
 *
 * localStorage にトランザクションは無いため、
 * 「一部のキーだけ新しく、残りは古い」という中途半端な状態を避ける必要がある。
 * そこで、書き込み前に現在の生データを控えておき、
 * 1つでも失敗したら控えた値へ戻す（ロールバック）。
 */
export type RestoreResult =
  | { ok: true }
  | { ok: false; error: string; rolledBack: boolean }

/** 書き込む順番（ロールバックも同じキー集合を対象にする） */
const KEYS = [NAMES_KEY, SCHEDULES_KEY, TIMED_EVENTS_KEY, RECURRING_RULES_KEY] as const

export function restoreToLocalStorage(data: BackupData): RestoreResult {
  // 1. 先に全部を文字列化しておく（書き込み中に例外が出る箇所を減らす）
  let payload: Record<string, string>
  try {
    payload = {
      [NAMES_KEY]: JSON.stringify(data.names),
      [SCHEDULES_KEY]: JSON.stringify(data.schedules),
      [TIMED_EVENTS_KEY]: JSON.stringify(data.timedEvents),
      [RECURRING_RULES_KEY]: JSON.stringify(data.recurringRules),
    }
  } catch {
    return { ok: false, error: '復元データを準備できませんでした。', rolledBack: true }
  }

  // 2. 現在の生データを控える（存在しないキーは null のまま覚えておく）
  const previous: Record<string, string | null> = {}
  try {
    for (const key of KEYS) previous[key] = localStorage.getItem(key)
  } catch {
    return { ok: false, error: '現在のデータを読み取れなかったため、復元を中止しました。', rolledBack: true }
  }

  // 3. 順に書き込む
  const written: string[] = []
  try {
    for (const key of KEYS) {
      localStorage.setItem(key, payload[key])
      written.push(key)
    }
    return { ok: true }
  } catch {
    // 4. 失敗したら、書き込んだ分を元へ戻す
    let rolledBack = true
    for (const key of written) {
      try {
        const before = previous[key]
        if (before === null) localStorage.removeItem(key)
        else localStorage.setItem(key, before)
      } catch {
        rolledBack = false
      }
    }
    return {
      ok: false,
      error: rolledBack
        ? '復元中に保存エラーが発生しました。現在のデータは元の状態へ戻しました。'
        : '復元中に保存エラーが発生し、元の状態へ戻すことにも失敗しました。ブラウザの保存容量を確認したうえで、ページを再読み込みして状態をご確認ください。',
      rolledBack,
    }
  }
}
