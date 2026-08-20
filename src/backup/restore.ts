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
 *
 * ロールバックでは、まず書き込み済みの新データを削除して保存容量を空けてから
 * 元の値を戻す。先に削除しないと、残っている大きな新データのせいで
 * 「元データ全体は容量内に収まるのに、戻す途中で再び容量不足になる」ことがある。
 *
 * 最後に4キーを読み直し、復元前と完全一致した場合だけロールバック成功とする。
 * 例外が出なかったことだけを根拠に成功と判断しない。
 */

/** localStorage 互換の最小インターフェース（テストで差し替えられるようにする） */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type RestoreResult =
  | { ok: true }
  | { ok: false; error: string; rolledBack: boolean }

/** 書き込む順番（ロールバックも同じキー集合を対象にする） */
const KEYS = [NAMES_KEY, SCHEDULES_KEY, TIMED_EVENTS_KEY, RECURRING_RULES_KEY] as const

const ROLLBACK_OK =
  '復元中に保存エラーが発生しました。現在のデータは元の状態へ戻しました。'
const ROLLBACK_FAILED =
  '復元中に保存エラーが発生し、元の状態へ戻すことにも失敗しました。' +
  'ブラウザの保存容量を確認したうえで、ページを再読み込みして状態をご確認ください。'

/**
 * 4キーを読み直し、控えておいた値と完全一致するか確かめる。
 * 読み取り自体に失敗した場合も不一致として扱う。
 */
function matchesPrevious(storage: StorageLike, previous: Record<string, string | null>): boolean {
  for (const key of KEYS) {
    let current: string | null
    try {
      current = storage.getItem(key)
    } catch {
      return false
    }
    if (current !== previous[key]) return false
  }
  return true
}

export function restoreToLocalStorage(
  data: BackupData,
  storage: StorageLike = localStorage,
): RestoreResult {
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
    for (const key of KEYS) previous[key] = storage.getItem(key)
  } catch {
    return {
      ok: false,
      error: '現在のデータを読み取れなかったため、復元を中止しました。',
      rolledBack: true,
    }
  }

  // 3. 順に書き込む
  const written: string[] = []
  try {
    for (const key of KEYS) {
      storage.setItem(key, payload[key])
      written.push(key)
    }
    return { ok: true }
  } catch {
    /*
     * 4. 失敗した。まず書き込み済みの新データを削除して容量を空ける。
     *    （元データ全体は元々収まっていたので、新データを退けてから戻す）
     */
    for (const key of written) {
      try {
        storage.removeItem(key)
      } catch {
        // 削除できなくても、次の書き戻しと最終確認で判定する
      }
    }

    // 5. 元の値へ戻す（元が null だったキーは削除された状態のままにする）
    for (const key of written) {
      const before = previous[key]
      if (before === null) continue
      try {
        storage.setItem(key, before)
      } catch {
        // ここで失敗しても、最終確認で不一致として検出する
      }
    }

    // 6. 4キーを読み直し、復元前と完全一致した場合だけ成功とする
    const rolledBack = matchesPrevious(storage, previous)

    return {
      ok: false,
      error: rolledBack ? ROLLBACK_OK : ROLLBACK_FAILED,
      rolledBack,
    }
  }
}
