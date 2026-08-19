import { useMemo, useState } from 'react'
import { COLUMN_IDS, type ColumnId, type FamilyNames } from '../types'
import Dialog from './Dialog'
import type { RecurringRuleDraft, Weekday, WeeklyRecurringRule } from './types'
import {
  formatDateKeyJa,
  formatDateKeySlash,
  formatTimeRange,
  isValidDateKey,
  isValidTime,
  todayDateKey,
} from './dateUtils'

const WEEKDAY_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] as const

type Props = {
  rules: WeeklyRecurringRule[]
  names: FamilyNames
  /** 一覧を開いた直後に、このルールの編集画面を開く（発生日から「編集」した場合） */
  initialEditRuleId?: string | null
  onSave: (draft: RecurringRuleDraft) => void
  onDelete: (ruleId: string) => void
  onToggleEnabled: (ruleId: string) => void
  onClose: () => void
}

function emptyDraft(): RecurringRuleDraft {
  return {
    id: null,
    columnId: 'member1',
    title: '',
    weekday: 2,
    startTime: '',
    endTime: '',
    startDate: todayDateKey(),
    endDate: '',
    enabled: true,
    excludedDates: [],
  }
}

function toDraft(rule: WeeklyRecurringRule): RecurringRuleDraft {
  return {
    id: rule.id,
    columnId: rule.columnId,
    title: rule.title,
    weekday: rule.weekday,
    startTime: rule.startTime ?? '',
    endTime: rule.endTime ?? '',
    startDate: rule.startDate,
    endDate: rule.endDate ?? '',
    enabled: rule.enabled,
    excludedDates: [...rule.excludedDates],
  }
}

export default function RecurringRuleManager({
  rules,
  names,
  initialEditRuleId,
  onSave,
  onDelete,
  onToggleEnabled,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<RecurringRuleDraft | null>(() => {
    if (!initialEditRuleId) return null
    const found = rules.find((r) => r.id === initialEditRuleId)
    return found ? toDraft(found) : null
  })
  const [error, setError] = useState<string | null>(null)

  // 曜日 → 開始時間 → 対象家族 の順に並べ、見つけやすくする
  const sorted = useMemo(() => {
    return [...rules].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday
      const at = a.startTime ?? '99:99'
      const bt = b.startTime ?? '99:99'
      if (at !== bt) return at < bt ? -1 : 1
      return COLUMN_IDS.indexOf(a.columnId) - COLUMN_IDS.indexOf(b.columnId)
    })
  }, [rules])

  const update = (patch: Partial<RecurringRuleDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      if (patch.startTime === '') next.endTime = ''
      return next
    })
    setError(null)
  }

  const handleSave = () => {
    if (!draft) return
    const title = draft.title.trim()
    if (title === '') {
      setError('予定名を入力してください。')
      return
    }
    if (!isValidDateKey(draft.startDate)) {
      setError('開始日を正しく入力してください。')
      return
    }
    if (draft.startTime !== '' && !isValidTime(draft.startTime)) {
      setError('開始時間は 17:00 のような形式で入力してください。')
      return
    }
    if (draft.endTime !== '' && !isValidTime(draft.endTime)) {
      setError('終了時間は 18:00 のような形式で入力してください。')
      return
    }
    if (draft.endTime !== '' && draft.startTime === '') {
      setError('終了時間だけを設定することはできません。開始時間も入力してください。')
      return
    }
    if (draft.startTime !== '' && draft.endTime !== '' && draft.endTime < draft.startTime) {
      setError('終了時間は開始時間より後にしてください。')
      return
    }
    if (draft.endDate !== '') {
      if (!isValidDateKey(draft.endDate)) {
        setError('終了日を正しく入力してください。')
        return
      }
      if (draft.endDate < draft.startDate) {
        setError('終了日は開始日より後にしてください。')
        return
      }
    }
    onSave({ ...draft, title })
    setDraft(null)
  }

  const handleDelete = (rule: WeeklyRecurringRule) => {
    if (!window.confirm(`定期予定「${rule.title}」を削除します。よろしいですか？`)) return
    onDelete(rule.id)
  }

  // ---- 編集フォーム ----
  if (draft) {
    return (
      <Dialog
        title={draft.id ? '定期予定を編集' : '新しい定期予定'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <span className="ev-footer-spacer" />
            <button type="button" className="ev-button" onClick={() => setDraft(null)}>
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
          <label htmlFor="rr-title">予定名（必須）</label>
          <input
            id="rr-title"
            type="text"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="例：ピアノ"
          />
        </div>

        <div className="ev-field">
          <label htmlFor="rr-column">対象</label>
          <select
            id="rr-column"
            value={draft.columnId}
            onChange={(e) => update({ columnId: e.target.value as ColumnId })}
          >
            {COLUMN_IDS.map((id) => (
              <option key={id} value={id}>
                {names[id]}
              </option>
            ))}
          </select>
        </div>

        <div className="ev-field">
          <label htmlFor="rr-weekday">曜日</label>
          <select
            id="rr-weekday"
            value={draft.weekday}
            onChange={(e) => update({ weekday: Number(e.target.value) as Weekday })}
          >
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={index}>
                毎週 {name}
              </option>
            ))}
          </select>
        </div>

        <div className="ev-field-row">
          <div className="ev-field">
            <label htmlFor="rr-start-time">開始時間</label>
            <input
              id="rr-start-time"
              type="time"
              value={draft.startTime}
              onChange={(e) => update({ startTime: e.target.value })}
            />
          </div>
          <div className="ev-field">
            <label htmlFor="rr-end-time">終了時間（任意）</label>
            <input
              id="rr-end-time"
              type="time"
              value={draft.endTime}
              disabled={draft.startTime === ''}
              onChange={(e) => update({ endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="ev-field-row">
          <div className="ev-field">
            <label htmlFor="rr-start-date">開始日（必須）</label>
            <input
              id="rr-start-date"
              type="date"
              value={draft.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </div>
          <div className="ev-field">
            <label htmlFor="rr-end-date">終了日（空欄なら終了日なし）</label>
            <input
              id="rr-end-date"
              type="date"
              value={draft.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="ev-field ev-field--check">
          <label htmlFor="rr-enabled">
            <input
              id="rr-enabled"
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            この定期予定を有効にする
          </label>
        </div>

        {draft.excludedDates.length > 0 && (
          <section className="ev-excluded">
            <h3 className="ev-excluded__title">休みにした日</h3>
            <ul className="ev-excluded__list">
              {[...draft.excludedDates].sort().map((dateKey) => (
                <li key={dateKey}>
                  <span>{formatDateKeyJa(dateKey)}</span>
                  <button
                    type="button"
                    className="ev-button ev-button--small"
                    onClick={() =>
                      update({ excludedDates: draft.excludedDates.filter((d) => d !== dateKey) })
                    }
                  >
                    元に戻す
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Dialog>
    )
  }

  // ---- 一覧 ----
  return (
    <Dialog
      title="定期予定"
      wide
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="ev-button ev-button--primary"
            onClick={() => setDraft(emptyDraft())}
          >
            新しい定期予定を追加
          </button>
          <span className="ev-footer-spacer" />
          <button type="button" className="ev-button" onClick={onClose}>
            閉じる
          </button>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="ev-empty">定期予定はまだ登録されていません。</p>
      ) : (
        <ul className="ev-rule-list">
          {sorted.map((rule) => {
            const time = formatTimeRange(rule.startTime, rule.endTime)
            return (
              <li key={rule.id} className={rule.enabled ? 'ev-rule' : 'ev-rule ev-rule--disabled'}>
                <div className="ev-rule__main">
                  <p className="ev-rule__target">{names[rule.columnId]}</p>
                  <p className="ev-rule__when">
                    毎週 {WEEKDAY_NAMES[rule.weekday]}
                    {time && <span className="ev-rule__time">{time}</span>}
                  </p>
                  <p className="ev-rule__title">{rule.title}</p>
                  <p className="ev-rule__range">
                    {formatDateKeySlash(rule.startDate)}〜
                    {rule.endDate ? formatDateKeySlash(rule.endDate) : '終了日なし'}
                  </p>
                  <p className="ev-rule__status">
                    {rule.enabled ? '有効' : '無効'}
                    {rule.excludedDates.length > 0 && `／休み ${rule.excludedDates.length}日`}
                  </p>
                </div>
                <div className="ev-rule__actions">
                  <button
                    type="button"
                    className="ev-button ev-button--small"
                    onClick={() => setDraft(toDraft(rule))}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="ev-button ev-button--small"
                    onClick={() => onToggleEnabled(rule.id)}
                  >
                    {rule.enabled ? '無効にする' : '有効にする'}
                  </button>
                  <button
                    type="button"
                    className="ev-button ev-button--small ev-button--danger"
                    onClick={() => handleDelete(rule)}
                  >
                    削除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="ev-hint">
        今回対応している繰り返しは「毎週1曜日」だけです。
        複数の曜日に入れたい場合は、曜日ごとに定期予定を登録してください。
      </p>
    </Dialog>
  )
}
