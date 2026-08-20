import { useRef, useState } from 'react'
import Dialog from '../events/Dialog'
import { buildBackupFileName, createBackup, downloadBackupFile, serializeBackup } from './backupFormat'
import { MAX_BACKUP_BYTES, validateBackupText } from './validation'
import type { BackupData, BackupSummary, FamilyCalendarBackupV1 } from './types'

type Props = {
  /** 保存するデータ。必ずReactの最新状態を渡すこと */
  getCurrentData: () => BackupData
  /** 復元を実行する。成功なら null、失敗ならエラーメッセージを返す */
  onRestore: (data: BackupData) => string | null
  onClose: () => void
  /** バックアップ／復元の結果を画面へ知らせる */
  onNotify: (message: string) => void
}

type Pending = {
  fileName: string
  backup: FamilyCalendarBackupV1
  summary: BackupSummary
}

/**
 * 対象期間の表示。
 *   終了日なしの定期予定がある → 「2026年8月〜終了日なし」
 *   それ以外                   → 「2026年8月〜2027年3月」（同じ月なら1つだけ）
 *   4種類すべて空のときだけ     → 「予定なし」
 */
function formatMonthRange(summary: BackupSummary): string {
  const label = (mk: string) => {
    const [y, m] = mk.split('-')
    return `${Number(y)}年${Number(m)}月`
  }

  if (!summary.firstMonth || !summary.lastMonth) return '予定なし'

  if (summary.hasOpenEndedRecurring) {
    return `${label(summary.firstMonth)}〜終了日なし`
  }

  return summary.firstMonth === summary.lastMonth
    ? label(summary.firstMonth)
    : `${label(summary.firstMonth)}〜${label(summary.lastMonth)}`
}

export default function BackupDialog({ getCurrentData, onRestore, onClose, onNotify }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    setError(null)
    try {
      const now = new Date()
      // localStorage ではなく、Reactの最新状態からバックアップを作る
      const backup = createBackup(getCurrentData(), now)
      downloadBackupFile(serializeBackup(backup), buildBackupFileName(now))
      // 実際に保存されたかはブラウザ・OS側の操作次第なので「開始しました」と伝える
      onNotify('バックアップファイルの保存を開始しました。')
    } catch {
      setError('バックアップファイルを作成できませんでした。')
    }
  }

  const handleFile = async (file: File | undefined) => {
    setError(null)
    setPending(null)
    if (!file) return

    if (file.size === 0) {
      setError('ファイルが空です。家族カレンダーのバックアップファイルを選んでください。')
      return
    }
    if (file.size > MAX_BACKUP_BYTES) {
      setError('ファイルサイズが大きすぎます。家族カレンダーのバックアップファイルを選んでください。')
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      setError('ファイルを読み込めませんでした。もう一度お試しください。')
      return
    }

    const result = validateBackupText(text)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPending({ fileName: file.name, backup: result.backup, summary: result.summary })
  }

  const handleConfirmRestore = () => {
    if (!pending) return
    const message = onRestore(pending.backup.data)
    if (message) {
      setError(message)
      return
    }
    setPending(null)
    onNotify('バックアップから復元しました。')
    onClose()
  }

  return (
    <Dialog title="バックアップ" onClose={onClose} wide>
      {error && (
        <p className="bk-error" role="alert">
          {error}
        </p>
      )}

      {/* --- 保存 --- */}
      <section className="bk-section">
        <h3 className="bk-section__title">バックアップを保存</h3>
        <p className="bk-section__text">
          家族名とすべての予定をJSONファイルに保存します。
          このファイルには個人情報が含まれるため、安全な場所に保管してください。
        </p>
        <button type="button" className="bk-button bk-button--primary" onClick={handleSave}>
          バックアップを保存
        </button>
      </section>

      {/* --- 復元 --- */}
      <section className="bk-section">
        <h3 className="bk-section__title">バックアップから復元</h3>
        <p className="bk-section__text">
          保存したJSONファイルから、家族名とすべての予定を復元します。
          復元すると、この端末に現在保存されているデータは置き換わります。
        </p>

        <input
          ref={fileInputRef}
          id="bk-file"
          type="file"
          accept=".json,application/json"
          className="bk-file-input"
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            // 同じファイルを続けて選んでも change が起きるようにする
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="bk-button"
          onClick={() => fileInputRef.current?.click()}
        >
          ファイルを選ぶ
        </button>

        {pending && (
          <div className="bk-preview">
            <h4 className="bk-preview__title">バックアップ内容</h4>
            <dl className="bk-preview__list">
              <div>
                <dt>ファイル名</dt>
                <dd>{pending.fileName}</dd>
              </div>
              <div>
                <dt>作成日時</dt>
                <dd>{pending.summary.exportedAtLabel ?? '不明'}</dd>
              </div>
              <div>
                <dt>家族名</dt>
                <dd>{pending.summary.nameCount}件</dd>
              </div>
              <div>
                <dt>自由入力メモ</dt>
                <dd>{pending.summary.scheduleCount}件</dd>
              </div>
              <div>
                <dt>時間付き予定</dt>
                <dd>{pending.summary.timedEventCount}件</dd>
              </div>
              <div>
                <dt>定期予定</dt>
                <dd>{pending.summary.recurringRuleCount}件</dd>
              </div>
              <div>
                <dt>休みにした日</dt>
                <dd>{pending.summary.excludedDateCount}件</dd>
              </div>
              <div>
                <dt>対象期間</dt>
                <dd>{formatMonthRange(pending.summary)}</dd>
              </div>
            </dl>

            <p className="bk-warning">
              復元すると、この端末に現在保存されている家族名と予定は、
              このバックアップの内容ですべて置き換わります。
              <br />
              必要な場合は、復元前に現在のデータをバックアップしてください。
            </p>

            <div className="bk-preview__actions">
              <button
                type="button"
                className="bk-button bk-button--danger"
                onClick={handleConfirmRestore}
              >
                このバックアップで復元する
              </button>
              <button type="button" className="bk-button" onClick={() => setPending(null)}>
                キャンセル
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="bk-note">
        バックアップファイルには、家族名や予定などの個人情報が含まれます。
        第三者と共有せず、安全な場所に保管してください。
        このファイルがGitHubや外部のサーバーへ送信されることはありません。
      </p>
    </Dialog>
  )
}
