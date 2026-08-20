import { useMemo, useState } from 'react'
import { COLUMN_IDS, type ColumnId, type FamilyNames } from '../types'
import { getDaysInMonth } from '../calendar'
import Dialog from '../events/Dialog'
import { isValidDateKey, toDateKey, todayDateKey } from '../events/dateUtils'
import { formatRangeLabel, rangeDayLength } from './describe'
import { RANGE_PALETTE, compareRangeEvents, paletteIndexFor } from './layout'
import type { DateRangeEvent, RangeEventDraft } from './types'

type Props = {
  events: DateRangeEvent[]
  names: FamilyNames
  /** 表示中の年月（一覧の並び順に使う） */
  year: number
  month: number
  /** 一覧を開いた直後に、この予定の編集画面を開く（帯やラベルから開いた場合） */
  initialEditId?: string | null
  onSave: (draft: RangeEventDraft) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function emptyDraft(year: number, month: number): RangeEventDraft {
  const today = todayDateKey()
  const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
  // 表示中の月に今日が含まれていれば今日、含まれていなければその月の1日
  const start = today.startsWith(`${monthKey}-`) ? today : toDateKey(year, month, 1)
  return { id: null, columnId: 'member1', title: '', startDate: start, endDate: start }
}

function toDraft(event: DateRangeEvent): RangeEventDraft {
  return {
    id: event.id,
    columnId: event.columnId,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
  }
}

export default function RangeEventManager({
  events,
  names,
  year,
  month,
  initialEditId,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<RangeEventDraft | null>(() => {
    if (!initialEditId) return null
    const found = events.find((e) => e.id === initialEditId)
    return found ? toDraft(found) : null
  })
  const [error, setError] = useState<string | null>(null)

  /*
   * 並び順
   *   1. 表示中の月と重なる予定
   *   2. これからの予定
   *   3. 過ぎた予定
   * 同じ分類の中では開始日が早い順。
   */
  const sorted = useMemo(() => {
    const monthFirst = toDateKey(year, month, 1)
    const monthLast = toDateKey(year, month, getDaysInMonth(year, month))
    const groupOf = (e: DateRangeEvent) => {
      if (e.startDate <= monthLast && e.endDate >= monthFirst) return 0
      return e.startDate > monthLast ? 1 : 2
    }
    return [...events].sort((a, b) => {
      const ga = groupOf(a)
      const gb = groupOf(b)
      if (ga !== gb) return ga - gb
      return compareRangeEvents(a, b)
    })
  }, [events, year, month])

  const update = (patch: Partial<RangeEventDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      // 開始日を後ろへ動かしたときは、終了日も一緒に動かして入力の手間を減らす
      if (patch.startDate !== undefined && next.endDate !== '' && next.endDate < next.startDate) {
        next.endDate = next.startDate
      }
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
    if (!isValidDateKey(draft.endDate)) {
      setError('終了日を正しく入力してください。')
      return
    }
    if (draft.endDate < draft.startDate) {
      setError('終了日は開始日以降の日付を指定してください。')
      return
    }
    onSave({ ...draft, title })
    setDraft(null)
  }

  const handleDelete = (event: DateRangeEvent) => {
    if (!window.confirm(`期間予定「${event.title}」を削除します。よろしいですか？`)) return
    onDelete(event.id)
  }

  const handleDeleteFromForm = () => {
    if (!draft?.id) return
    const found = events.find((e) => e.id === draft.id)
    if (!found) return
    if (!window.confirm(`期間予定「${found.title}」を削除します。よろしいですか？`)) return
    onDelete(found.id)
    setDraft(null)
  }

  // ---- 追加・編集フォーム ----
  if (draft) {
    const sameDay = draft.startDate !== '' && draft.startDate === draft.endDate
    return (
      <Dialog
        title={draft.id ? '期間予定を編集' : '新しい期間予定'}
        onClose={() => setDraft(null)}
        footer={
          <>
            {draft.id && (
              <button
                type="button"
                className="ev-button ev-button--danger"
                onClick={handleDeleteFromForm}
              >
                削除
              </button>
            )}
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
          <label htmlFor="rg-title">予定名（必須）</label>
          <input
            id="rg-title"
            type="text"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="例：夏季保育"
          />
        </div>

        <div className="ev-field">
          <label htmlFor="rg-column">対象</label>
          <select
            id="rg-column"
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

        <div className="ev-field-row">
          <div className="ev-field">
            <label htmlFor="rg-start">開始日（必須）</label>
            <input
              id="rg-start"
              type="date"
              value={draft.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </div>
          <div className="ev-field">
            <label htmlFor="rg-end">終了日（必須）</label>
            <input
              id="rg-end"
              type="date"
              value={draft.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
            />
          </div>
        </div>

        {sameDay && (
          <p className="ev-hint" role="status">
            1日だけの予定には、通常の「予定を追加」も利用できます。
          </p>
        )}

        <p className="ev-hint">
          期間予定は終日の予定として扱うため、時間は設定しません。
          時間を指定したい1日の予定には「予定を追加」をお使いください。
        </p>
      </Dialog>
    )
  }

  // ---- 一覧 ----
  return (
    <Dialog
      title="期間予定"
      wide
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="ev-button ev-button--primary"
            onClick={() => setDraft(emptyDraft(year, month))}
          >
            新しい期間予定を追加
          </button>
          <span className="ev-footer-spacer" />
          <button type="button" className="ev-button" onClick={onClose}>
            閉じる
          </button>
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="ev-empty">期間予定はまだ登録されていません。</p>
      ) : (
        <ul className="ev-rule-list">
          {sorted.map((event) => {
            const palette = RANGE_PALETTE[paletteIndexFor(event.id)]
            const days = rangeDayLength(event.startDate, event.endDate)
            return (
              <li
                key={event.id}
                className="ev-rule range-item"
                style={{ borderLeftColor: palette.band }}
              >
                <div className="ev-rule__main">
                  <p className="ev-rule__target">{names[event.columnId]}</p>
                  <p className="ev-rule__range">
                    {formatRangeLabel(event.startDate, event.endDate)}
                  </p>
                  <p className="ev-rule__title">{event.title}</p>
                  <p className="ev-rule__status">
                    {days === 1 ? '1日だけの期間予定' : `${days}日間`}
                  </p>
                </div>
                <div className="ev-rule__actions">
                  <button
                    type="button"
                    className="ev-button ev-button--small"
                    onClick={() => setDraft(toDraft(event))}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="ev-button ev-button--small ev-button--danger"
                    onClick={() => handleDelete(event)}
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
        期間予定は、開始日から終了日まで連続する終日の予定です。
        カレンダーでは対象の予定欄に縦の帯で表示され、月や年をまたいでもつながって見えます。
        時間を指定したい1日の予定には「予定を追加」を、
        毎週くり返す予定には「定期予定」をお使いください。
      </p>
    </Dialog>
  )
}
