import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CalendarTable from './CalendarTable'
import {
  buildMonthDays,
  clampMonth,
  clampYear,
  getDaysInMonth,
  shiftMonth,
  toMonthKey,
  MAX_YEAR,
  MIN_YEAR,
} from './calendar'
import { loadInitialState, saveNames, saveSchedules } from './storage'
import { COLUMN_IDS, type ColumnId, type FamilyNames, type ScheduleStore } from './types'
import InstallGuide from './pwa/InstallGuide'
import OfflineIndicator from './pwa/OfflineIndicator'
import PwaUpdatePrompt from './pwa/PwaUpdatePrompt'
import './App.css'
import './pwa/pwa.css'
import './print.css'

/** localStorageへ書き込むまでの待ち時間（入力のたびに書かないためのデバウンス） */
const SAVE_DEBOUNCE_MS = 400

const COLUMN_LABELS: Record<ColumnId, string> = {
  everyone: '1列目',
  member1: '2列目',
  member2: '3列目',
  member3: '4列目',
  member4: '5列目',
  member5: '6列目',
}

export default function App() {
  const [initial] = useState(loadInitialState)
  const today = useMemo(() => new Date(), [])

  const [year, setYear] = useState(() => today.getFullYear())
  const [month, setMonth] = useState(() => today.getMonth() + 1)
  // 年の入力欄は入力途中（"20" など）を許すため、文字列としても保持する
  const [yearText, setYearText] = useState(() => String(today.getFullYear()))

  const [names, setNames] = useState<FamilyNames>(initial.names)
  const [schedules, setSchedules] = useState<ScheduleStore>(initial.schedules)

  // 読み込み時のエラーは残したままにし、保存エラーは発生／解消のたびに更新する
  const loadError = initial.error
  const [saveError, setSaveError] = useState<string | null>(null)
  const errorMessage = saveError ?? loadError

  const monthKey = toMonthKey(year, month)
  const days = useMemo(() => buildMonthDays(year, month), [year, month])
  const dayCount = getDaysInMonth(year, month)
  const monthSchedule = schedules[monthKey] ?? {}

  // --- localStorageへの保存（デバウンス＋離脱時の書き出し） ------------------

  // 離脱時に書き出すため、最新の内容を保持しておく
  const latest = useRef({ names, schedules })
  useEffect(() => {
    latest.current = { names, schedules }
  }, [names, schedules])

  /*
   * 利用者が実際に入力・変更するまでは保存しない。
   * 起動直後に書き戻すと、読み込みに失敗した保存データを
   * そのまま初期値で上書きしてしまうため。
   */
  const isDirty = useRef(false)

  useEffect(() => {
    if (!isDirty.current) return
    const timer = setTimeout(() => setSaveError(saveNames(names)), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [names])

  useEffect(() => {
    if (!isDirty.current) return
    const timer = setTimeout(() => setSaveError(saveSchedules(schedules)), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [schedules])

  // タブを閉じる／隠す直前に、デバウンス待ちの内容を確実に書き出す
  useEffect(() => {
    const flush = () => {
      if (!isDirty.current) return
      saveNames(latest.current.names)
      saveSchedules(latest.current.schedules)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // --- 操作 ------------------------------------------------------------------

  /** 予定セルの変更。年月キー・日付・列IDで場所を特定して更新する */
  const handleCellChange = useCallback(
    (day: number, columnId: ColumnId, value: string) => {
      isDirty.current = true
      setSchedules((prev) => {
        const prevMonth = prev[monthKey] ?? {}
        const prevDay = prevMonth[String(day)] ?? {}
        return {
          ...prev,
          [monthKey]: {
            ...prevMonth,
            [String(day)]: { ...prevDay, [columnId]: value },
          },
        }
      })
    },
    [monthKey],
  )

  const goToMonth = (step: number) => {
    const next = shiftMonth(year, month, step)
    const nextYear = clampYear(next.year)
    setYear(nextYear)
    setMonth(next.month)
    setYearText(String(nextYear))
  }

  const handleYearInput = (text: string) => {
    setYearText(text)
    const parsed = Number(text)
    if (/^\d{4}$/.test(text) && parsed >= MIN_YEAR && parsed <= MAX_YEAR) {
      setYear(parsed)
    }
  }

  // 入力途中の値で確定させないよう、フォーカスが外れた時点で範囲内へ丸める
  const handleYearBlur = () => {
    const fixed = clampYear(Number(yearText))
    setYear(fixed)
    setYearText(String(fixed))
  }

  const handleNameChange = (id: ColumnId, value: string) => {
    isDirty.current = true
    setNames((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <div className="app" style={{ '--day-count': dayCount } as React.CSSProperties}>
      {errorMessage && (
        <p className="error-banner" role="alert">
          {errorMessage}
        </p>
      )}

      {/* 操作部分（印刷されない） */}
      <div className="controls no-print">
        <div className="controls__row">
          <h1 className="controls__title">家族カレンダー</h1>

          <button type="button" onClick={() => goToMonth(-1)}>
            前月
          </button>

          <label className="field">
            年
            <input
              type="number"
              className="field__year"
              value={yearText}
              min={MIN_YEAR}
              max={MAX_YEAR}
              onChange={(e) => handleYearInput(e.target.value)}
              onBlur={handleYearBlur}
            />
          </label>

          <label className="field">
            月
            <select
              className="field__month"
              value={month}
              onChange={(e) => setMonth(clampMonth(Number(e.target.value)))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={() => goToMonth(1)}>
            次月
          </button>

          <span className="controls__current">
            表示中：{year}年 {month}月
          </span>

          <OfflineIndicator />

          <InstallGuide />

          <button type="button" className="controls__print" onClick={() => window.print()}>
            印刷
          </button>
        </div>

        <fieldset className="names">
          <legend>家族名の変更（変更しても入力済みの予定は残ります）</legend>
          {COLUMN_IDS.map((id) => (
            <label key={id} className="field">
              {COLUMN_LABELS[id]}
              <input
                type="text"
                value={names[id]}
                onChange={(e) => handleNameChange(id, e.target.value)}
              />
            </label>
          ))}
        </fieldset>
      </div>

      {/* 印刷対象 */}
      <div className="sheet">
        <h2 className="sheet__title">
          <span className="sheet__title-app">家族カレンダー</span>
          <span className="sheet__title-date">
            {year}年 {month}月
          </span>
        </h2>

        <div className="table-scroll">
          <CalendarTable
            days={days}
            names={names}
            monthSchedule={monthSchedule}
            onCellChange={handleCellChange}
          />
        </div>
      </div>

      {/* 新しいバージョンの案内（押したときだけ更新する） */}
      <PwaUpdatePrompt />
    </div>
  )
}
