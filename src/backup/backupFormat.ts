import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type FamilyCalendarBackupV2,
} from './types'

/** 2桁ゼロ埋め */
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * バックアップ本体を作る（現在の形式は schemaVersion 2）。
 *
 * 引数の data は「Reactの最新状態」を渡すこと。
 * localStorage から読むと、デバウンス保存待ちの入力が欠ける可能性がある。
 */
export function createBackup(data: BackupData, now: Date = new Date()): FamilyCalendarBackupV2 {
  return {
    appId: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data: {
      names: data.names,
      schedules: data.schedules,
      timedEvents: data.timedEvents,
      recurringRules: data.recurringRules,
      rangeEvents: data.rangeEvents,
    },
  }
}

/**
 * ファイル名を作る（端末のローカル日時）。
 * 例: 家族カレンダー_2026-08-20_203045.json
 *
 * Windowsで使えない文字（: / \ など）は使わない。
 */
export function buildBackupFileName(now: Date = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `家族カレンダー_${date}_${time}.json`
}

/** 保存するJSON文字列（2スペース整形・日本語はそのまま） */
export function serializeBackup(backup: FamilyCalendarBackupV2): string {
  return JSON.stringify(backup, null, 2)
}

/**
 * ブラウザ標準の機能だけでダウンロードする。
 *
 * File System Access API には依存しない（iPhone Safari などでも動くようにするため）。
 * ダウンロードが始まる前に URL を破棄しないよう、revoke は次のタイミングまで遅らせる。
 */
export function downloadBackupFile(json: string, fileName: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()

  // クリック直後に revoke するとダウンロードが始まらない環境があるため、少し待つ
  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 60_000)
}
