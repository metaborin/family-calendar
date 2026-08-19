import { useState } from 'react'
import { COLUMN_IDS, type ColumnId, type FamilyNames } from '../types'
import Dialog from './Dialog'
import type { TimedEventDraft } from './types'
import { isValidTime, parseDateKey } from './dateUtils'

type Props = {
  draft: TimedEventDraft
  names: FamilyNames
  /** 編集中の予定を削除する（新規追加時は渡さない） */
  onDelete?: () => void
  onSave: (draft: TimedEventDraft) => void
  onClose: () => void
}

/** 日付指定の予定を追加・編集するダイアログ */
export default function EventEditor({ draft, names, onDelete, onSave, onClose }: Props) {
  const [value, setValue] = useState<TimedEventDraft>(draft)
  const [error, setError] = useState<string | null>(null)
  const isEditing = draft.id !== null

  const changed =
    value.title !== draft.title ||
    value.startTime !== draft.startTime ||
    value.endTime !== draft.endTime ||
    value.dateKey !== draft.dateKey ||
    value.columnId !== draft.columnId

  const update = (patch: Partial<TimedEventDraft>) => {
    setValue((prev) => {
      const next = { ...prev, ...patch }
      // 開始時間が空になったら、終了時間も空にする
      if (patch.startTime === '') next.endTime = ''
      return next
    })
    setError(null)
  }

  /** 保存せず閉じるとき、入力途中なら確認する */
  const requestClose = () => {
    if (changed && !window.confirm('保存していない変更があります。閉じてもよろしいですか？')) return
    onClose()
  }

  const handleSave = () => {
    const title = value.title.trim()
    if (title === '') {
      setError('予定名を入力してください。')
      return
    }
    if (parseDateKey(value.dateKey) === null) {
      setError('日付を正しく入力してください。')
      return
    }
    if (value.startTime !== '' && !isValidTime(value.startTime)) {
      setError('開始時間は 09:00 のような形式で入力してください。')
      return
    }
    if (value.endTime !== '' && !isValidTime(value.endTime)) {
      setError('終了時間は 09:00 のような形式で入力してください。')
      return
    }
    if (value.endTime !== '' && value.startTime === '') {
      setError('終了時間だけを設定することはできません。開始時間も入力してください。')
      return
    }
    if (value.startTime !== '' && value.endTime !== '' && value.endTime < value.startTime) {
      setError('終了時間は開始時間より後にしてください。')
      return
    }
    onSave({ ...value, title })
  }

  const handleDelete = () => {
    if (!onDelete) return
    if (!window.confirm(`「${draft.title}」を削除します。よろしいですか？`)) return
    onDelete()
  }

  return (
    <Dialog
      title={isEditing ? '予定を編集' : '予定を追加'}
      onClose={requestClose}
      footer={
        <>
          {onDelete && (
            <button type="button" className="ev-button ev-button--danger" onClick={handleDelete}>
              削除
            </button>
          )}
          <span className="ev-footer-spacer" />
          <button type="button" className="ev-button" onClick={requestClose}>
            キャンセル
          </button>
          <button type="button" className="ev-button ev-button--primary" onClick={handleSave}>
            保存
          </button>
        </>
      }
    >
      {error && (
        <p className="ev-error" role="alert">
          {error}
        </p>
      )}

      <div className="ev-field">
        <label htmlFor="ev-title">予定名（必須）</label>
        <input
          id="ev-title"
          type="text"
          value={value.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="例：ピアノ"
        />
      </div>

      <div className="ev-field">
        <label htmlFor="ev-date">日付</label>
        <input
          id="ev-date"
          type="date"
          value={value.dateKey}
          onChange={(e) => update({ dateKey: e.target.value })}
        />
      </div>

      <div className="ev-field">
        <label htmlFor="ev-column">対象</label>
        <select
          id="ev-column"
          value={value.columnId}
          onChange={(e) => update({ columnId: e.target.value as ColumnId })}
        >
          {COLUMN_IDS.map((id) => (
            <option key={id} value={id}>
              {names[id]}
            </option>
          ))}
        </select>
      </div>

      <div className="ev-field-row">
        <div className="ev-field">
          <label htmlFor="ev-start">開始時間</label>
          <input
            id="ev-start"
            type="time"
            value={value.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
          />
        </div>
        <div className="ev-field">
          <label htmlFor="ev-end">終了時間（任意）</label>
          <input
            id="ev-end"
            type="time"
            value={value.endTime}
            disabled={value.startTime === ''}
            onChange={(e) => update({ endTime: e.target.value })}
          />
        </div>
      </div>

      <p className="ev-hint">
        時間を入れずに保存すると、予定名だけが表示されます。
      </p>
    </Dialog>
  )
}
