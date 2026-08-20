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
import EventEditor from './events/EventEditor'
import RecurringRuleManager from './events/RecurringRuleManager'
import OccurrenceActions from './events/OccurrenceActions'
import {
  loadEventState,
  saveRecurringRules,
  saveTimedEvents,
} from './events/storage'
import { buildCellItems, getMonthOccurrences } from './events/recurrence'
import {
  addExcludedDate,
  applyRecurringRuleDraft,
  applyTimedEventDraft,
  removeRule,
  removeTimedEvent,
  toggleRuleEnabled,
} from './events/mutations'
import { toDateKey, todayDateKey } from './events/dateUtils'
import type {
  CellItem,
  RecurringRuleDraft,
  TimedEvent,
  TimedEventDraft,
  TimedEventStore,
  WeeklyRecurringRule,
} from './events/types'
import RangeEventManager from './range/RangeEventManager'
import { loadRangeEvents, saveRangeEvents } from './range/storage'
import { applyRangeEventDraft, removeRangeEvent } from './range/mutations'
import { buildMonthRangeLayout, printGutterMm, screenGutterPx } from './range/layout'
import type { DateRangeEvent, RangeEventDraft, RangeSegment } from './range/types'
import BackupDialog from './backup/BackupDialog'
import { restoreToLocalStorage } from './backup/restore'
import type { BackupData } from './backup/types'
import MonthHeader from './theme/MonthHeader'
import { getMonthTheme } from './theme/monthThemes'
import './App.css'
import './theme/monthTheme.css'
import './backup/backup.css'
import './pwa/pwa.css'
import './events/events.css'
import './range/range.css'
import './print.css'

/** 期間予定が無いセルで、毎回新しい配列を作らないための共有の空配列 */
const EMPTY_SEGMENTS: RangeSegment[] = []

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

  // 時間付き予定・定期予定（既存の自由入力とは別のlocalStorageキーに保存する）
  const [initialEvents] = useState(loadEventState)
  const [timedEvents, setTimedEvents] = useState<TimedEventStore>(initialEvents.timedEvents)
  const [recurringRules, setRecurringRules] = useState<WeeklyRecurringRule[]>(
    initialEvents.recurringRules,
  )

  // 期間予定（複数日にわたる終日予定。さらに別のlocalStorageキーへ保存する）
  const [initialRange] = useState(loadRangeEvents)
  const [rangeEvents, setRangeEvents] = useState<DateRangeEvent[]>(initialRange.rangeEvents)

  // ダイアログの開閉
  const [eventDraft, setEventDraft] = useState<TimedEventDraft | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [ruleToEdit, setRuleToEdit] = useState<string | null>(null)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [rangeToEdit, setRangeToEdit] = useState<string | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [occurrence, setOccurrence] = useState<{
    rule: WeeklyRecurringRule
    dateKey: string
  } | null>(null)

  // 読み込み時のエラーは残したままにし、保存エラーは発生／解消のたびに更新する
  const loadError = initial.error ?? initialEvents.error ?? initialRange.error
  const [saveError, setSaveError] = useState<string | null>(null)
  const errorMessage = saveError ?? loadError

  // 表示中の月から自動的に決まる（保存も設定も不要）
  const monthTheme = getMonthTheme(month)

  const monthKey = toMonthKey(year, month)
  const days = useMemo(() => buildMonthDays(year, month), [year, month])
  const dayCount = getDaysInMonth(year, month)
  const monthSchedule = schedules[monthKey] ?? {}

  // 定期予定は月ごとのデータへコピーせず、表示のたびにルールから計算する
  const occurrences = useMemo(
    () => getMonthOccurrences(recurringRules, year, month, dayCount),
    [recurringRules, year, month, dayCount],
  )

  const timedMonth = timedEvents[monthKey]

  /** セルへ表示する予定（時間付き＋定期予定を開始時間順に並べたもの） */
  const getCellItems = useCallback(
    (day: number, columnId: ColumnId): CellItem[] =>
      buildCellItems(
        timedMonth?.[String(day)]?.[columnId],
        occurrences.get(day)?.get(columnId),
        toDateKey(year, month, day),
      ),
    [timedMonth, occurrences, year, month],
  )

  /*
   * 期間予定は各日へ複製せず、開始日・終了日の1件から
   * 「表示中の月と重なる日」をそのつど計算する。
   * 月・年をまたぐ予定も、この計算だけで両方の月へ表示される。
   */
  const rangeLayout = useMemo(
    () => buildMonthRangeLayout(rangeEvents, year, month, dayCount),
    [rangeEvents, year, month, dayCount],
  )

  const getRangeSegments = useCallback(
    (day: number, columnId: ColumnId): RangeSegment[] =>
      rangeLayout.segments.get(day)?.get(columnId) ?? EMPTY_SEGMENTS,
    [rangeLayout],
  )

  /**
   * 列ごとに、帯の分だけ予定文字を右へ逃がすための余白。
   * 同じ列は月内で同じ幅にそろえ、行ごとに文字の左端がずれないようにする。
   */
  const rangeGutterStyles = useMemo(() => {
    const styles = {} as Record<ColumnId, React.CSSProperties | undefined>
    for (const columnId of COLUMN_IDS) {
      const lanes = rangeLayout.laneCounts[columnId]
      styles[columnId] =
        lanes > 0
          ? ({
              '--range-gutter': `${screenGutterPx(lanes)}px`,
              '--range-gutter-print': `${printGutterMm(lanes)}mm`,
            } as React.CSSProperties)
          : undefined
    }
    return styles
  }, [rangeLayout])

  // 予定が多い月は、印刷が1ページに収まらないことがあるため画面上で知らせる
  const printWarning = useMemo(() => {
    let maxPerCell = 0
    for (const day of days) {
      for (const columnId of COLUMN_IDS) {
        const labels = getRangeSegments(day.day, columnId).filter((s) => s.isFirstVisible).length
        const count = getCellItems(day.day, columnId).length + labels
        if (count > maxPerCell) maxPerCell = count
      }
    }
    return maxPerCell >= 4
  }, [days, getCellItems, getRangeSegments])

  // 同じ日に期間予定が重なりすぎると、印刷で見分けにくくなるため知らせる
  const overlapWarning = rangeLayout.maxOverlap >= 4

  // --- localStorageへの保存（デバウンス＋離脱時の書き出し） ------------------

  // 離脱時に書き出すため、最新の内容を保持しておく
  const latest = useRef({ names, schedules, timedEvents, recurringRules, rangeEvents })
  useEffect(() => {
    latest.current = { names, schedules, timedEvents, recurringRules, rangeEvents }
  }, [names, schedules, timedEvents, recurringRules, rangeEvents])

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

  useEffect(() => {
    if (!isDirty.current) return
    const timer = setTimeout(() => setSaveError(saveTimedEvents(timedEvents)), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [timedEvents])

  useEffect(() => {
    if (!isDirty.current) return
    const timer = setTimeout(
      () => setSaveError(saveRecurringRules(recurringRules)),
      SAVE_DEBOUNCE_MS,
    )
    return () => clearTimeout(timer)
  }, [recurringRules])

  useEffect(() => {
    if (!isDirty.current) return
    const timer = setTimeout(() => setSaveError(saveRangeEvents(rangeEvents)), SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [rangeEvents])

  // タブを閉じる／隠す直前に、デバウンス待ちの内容を確実に書き出す
  useEffect(() => {
    const flush = () => {
      if (!isDirty.current) return
      saveNames(latest.current.names)
      saveSchedules(latest.current.schedules)
      saveTimedEvents(latest.current.timedEvents)
      saveRecurringRules(latest.current.recurringRules)
      saveRangeEvents(latest.current.rangeEvents)
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

  // --- 時間付き予定 ----------------------------------------------------------

  /**
   * 追加時の日付の初期値。
   * 表示中の月に今日が含まれていれば今日、含まれていなければその月の1日。
   */
  const defaultDateKey = useCallback(() => {
    const today = todayDateKey()
    return today.startsWith(`${monthKey}-`) ? today : toDateKey(year, month, 1)
  }, [monthKey, year, month])

  /** 画面上部の「予定を追加」／セルの「＋」から開く */
  const openAddEvent = useCallback(
    (day?: number, columnId?: ColumnId) => {
      setEventDraft({
        id: null,
        originalDateKey: null,
        originalColumnId: null,
        dateKey: day === undefined ? defaultDateKey() : toDateKey(year, month, day),
        columnId: columnId ?? 'everyone',
        title: '',
        startTime: '',
        endTime: '',
      })
    },
    [defaultDateKey, year, month],
  )

  /** 既存の時間付き予定を押したときの編集 */
  const openEditEvent = useCallback(
    (day: number, columnId: ColumnId, event: TimedEvent) => {
      const dateKey = toDateKey(year, month, day)
      setEventDraft({
        id: event.id,
        originalDateKey: dateKey,
        originalColumnId: columnId,
        dateKey,
        columnId,
        title: event.title,
        startTime: event.startTime ?? '',
        endTime: event.endTime ?? '',
      })
    },
    [year, month],
  )

  const handleSaveEvent = (draft: TimedEventDraft) => {
    isDirty.current = true
    setTimedEvents((prev) => applyTimedEventDraft(prev, draft))
    setEventDraft(null)
  }

  const handleDeleteEvent = (draft: TimedEventDraft) => {
    if (draft.id === null || draft.originalDateKey === null || draft.originalColumnId === null) return
    isDirty.current = true
    setTimedEvents((prev) =>
      removeTimedEvent(prev, draft.originalDateKey!, draft.originalColumnId!, draft.id!),
    )
    setEventDraft(null)
  }

  // --- 定期予定 --------------------------------------------------------------

  const handleSaveRule = (draft: RecurringRuleDraft) => {
    isDirty.current = true
    setRecurringRules((prev) => applyRecurringRuleDraft(prev, draft))
    setRuleToEdit(null)
  }

  const handleDeleteRule = (ruleId: string) => {
    isDirty.current = true
    setRecurringRules((prev) => removeRule(prev, ruleId))
  }

  const handleToggleRule = (ruleId: string) => {
    isDirty.current = true
    setRecurringRules((prev) => toggleRuleEnabled(prev, ruleId))
  }

  /** 定期予定の発生日を押したときに開く選択ダイアログ */
  const openOccurrence = useCallback((rule: WeeklyRecurringRule, dateKey: string) => {
    setOccurrence({ rule, dateKey })
  }, [])

  /** 「この日だけ休みにする」（定期予定そのものは削除しない） */
  const handleSkipThisDay = () => {
    if (!occurrence) return
    isDirty.current = true
    setRecurringRules((prev) => addExcludedDate(prev, occurrence.rule.id, occurrence.dateKey))
    setOccurrence(null)
  }

  const handleEditRuleFromOccurrence = () => {
    if (!occurrence) return
    setRuleToEdit(occurrence.rule.id)
    setRulesOpen(true)
    setOccurrence(null)
  }

  const closeRules = () => {
    setRulesOpen(false)
    setRuleToEdit(null)
  }

  // --- 期間予定 --------------------------------------------------------------

  const handleSaveRangeEvent = (draft: RangeEventDraft) => {
    isDirty.current = true
    setRangeEvents((prev) => applyRangeEventDraft(prev, draft))
    setRangeToEdit(null)
  }

  const handleDeleteRangeEvent = (id: string) => {
    isDirty.current = true
    setRangeEvents((prev) => removeRangeEvent(prev, id))
    setRangeToEdit(null)
  }

  /** カレンダーの帯や予定名を押したときに、その期間予定の編集を開く */
  const openRangeEditor = useCallback((event: DateRangeEvent) => {
    setRangeToEdit(event.id)
    setRangeOpen(true)
  }, [])

  const closeRangeManager = () => {
    setRangeOpen(false)
    setRangeToEdit(null)
  }

  // --- バックアップ・復元 ------------------------------------------------------

  /**
   * バックアップに入れるデータ。
   * localStorage ではなく React の最新状態を渡すため、
   * 入力直後（デバウンス保存前）でも最新の内容が含まれる。
   */
  const getCurrentData = useCallback(
    (): BackupData => ({ names, schedules, timedEvents, recurringRules, rangeEvents }),
    [names, schedules, timedEvents, recurringRules, rangeEvents],
  )

  /** 通知は一定時間で自動的に消す（印刷はされない） */
  const toastTimer = useRef<number | undefined>(undefined)
  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 5000)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  /**
   * バックアップからの全置換。
   * 成功なら null、失敗ならエラーメッセージを返す（画面のデータは変更しない）。
   */
  const handleRestore = useCallback((data: BackupData): string | null => {
    // 1. localStorage をまとめて置き換える（失敗時は内部でロールバックされる）
    const result = restoreToLocalStorage(data)
    if (!result.ok) return result.error

    /*
     * 2. React の状態を更新する。
     *    これにより保存待ちのデバウンスタイマーは effect のクリーンアップで破棄され、
     *    復元前の古い入力が後から書き戻されることはない。
     */
    setNames(data.names)
    setSchedules(data.schedules)
    setTimedEvents(data.timedEvents)
    setRecurringRules(data.recurringRules)
    setRangeEvents(data.rangeEvents)

    /*
     * 3. 離脱時保存が参照する ref も、この場で同期しておく。
     *    （effect の実行を待たずにページが隠れても、古い内容を書き戻さないため）
     */
    latest.current = {
      names: data.names,
      schedules: data.schedules,
      timedEvents: data.timedEvents,
      recurringRules: data.recurringRules,
      rangeEvents: data.rangeEvents,
    }

    setSaveError(null)
    return null
  }, [])

  return (
    <div
      className="app"
      style={
        {
          '--day-count': dayCount,
          // 表示中の月から自動で決まる控えめな差し色（localStorageには保存しない）
          '--month-accent': monthTheme.accent,
          '--month-accent-soft': monthTheme.accentSoft,
          '--month-accent-border': monthTheme.accentBorder,
          '--month-action-accent': monthTheme.actionAccent,
          '--month-action-accent-hover': monthTheme.actionAccentHover,
        } as React.CSSProperties
      }
    >
      {errorMessage && (
        <p className="error-banner" role="alert">
          {errorMessage}
        </p>
      )}

      {/*
        操作部分（印刷されない）。
        可視タイトル「家族カレンダー」は月ヘッダー側の h1 に一本化したため、
        ここには置かない。代わりに領域の役割を aria-label で伝える。
      */}
      <div className="controls no-print" role="group" aria-label="カレンダー操作">
        <div className="controls__row">
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

          <button type="button" className="controls__primary" onClick={() => openAddEvent()}>
            予定を追加
          </button>

          <button
            type="button"
            className="controls__secondary"
            onClick={() => {
              setRangeToEdit(null)
              setRangeOpen(true)
            }}
          >
            期間予定
          </button>

          <button type="button" className="controls__secondary" onClick={() => setRulesOpen(true)}>
            定期予定
          </button>

          <InstallGuide />

          <button type="button" className="backup-button" onClick={() => setBackupOpen(true)}>
            バックアップ
          </button>

          <button type="button" className="controls__print controls__secondary" onClick={() => window.print()}>
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
        <MonthHeader year={year} month={month} illustration={monthTheme.illustration} />

        {overlapWarning && (
          <p className="ev-print-warning no-print">
            同じ日に期間予定が多く重なっています。
            印刷時に見づらくなる可能性があります（登録した期間予定は消えていません）。
          </p>
        )}

        {printWarning && (
          <p className="ev-print-warning no-print">
            予定が多い日があります。印刷すると1ページに収まらない場合があります
            （保存した予定が消えることはありません）。
          </p>
        )}

        <div className="table-scroll">
          <CalendarTable
            days={days}
            names={names}
            monthSchedule={monthSchedule}
            onCellChange={handleCellChange}
            getCellItems={getCellItems}
            getRangeSegments={getRangeSegments}
            rangeGutterStyles={rangeGutterStyles}
            onAddEvent={openAddEvent}
            onSelectTimedEvent={openEditEvent}
            onSelectRecurring={openOccurrence}
            onSelectRangeEvent={openRangeEditor}
          />
        </div>
      </div>

      {/* 予定の追加・編集 */}
      {eventDraft && (
        <EventEditor
          draft={eventDraft}
          names={names}
          onSave={handleSaveEvent}
          onDelete={eventDraft.id !== null ? () => handleDeleteEvent(eventDraft) : undefined}
          onClose={() => setEventDraft(null)}
        />
      )}

      {/* 定期予定の一覧・追加・編集 */}
      {rulesOpen && (
        <RecurringRuleManager
          rules={recurringRules}
          names={names}
          initialEditRuleId={ruleToEdit}
          onSave={handleSaveRule}
          onDelete={handleDeleteRule}
          onToggleEnabled={handleToggleRule}
          onClose={closeRules}
        />
      )}

      {/* 期間予定の一覧・追加・編集 */}
      {rangeOpen && (
        <RangeEventManager
          events={rangeEvents}
          names={names}
          year={year}
          month={month}
          initialEditId={rangeToEdit}
          onSave={handleSaveRangeEvent}
          onDelete={handleDeleteRangeEvent}
          onClose={closeRangeManager}
        />
      )}

      {/* 定期予定の発生日を押したときの選択 */}
      {occurrence && (
        <OccurrenceActions
          rule={occurrence.rule}
          dateKey={occurrence.dateKey}
          targetName={names[occurrence.rule.columnId]}
          onSkipThisDay={handleSkipThisDay}
          onEditRule={handleEditRuleFromOccurrence}
          onClose={() => setOccurrence(null)}
        />
      )}

      {/* バックアップ・復元 */}
      {backupOpen && (
        <BackupDialog
          getCurrentData={getCurrentData}
          onRestore={handleRestore}
          onNotify={notify}
          onClose={() => setBackupOpen(false)}
        />
      )}

      {/* バックアップ・復元の結果通知（印刷されない） */}
      {toast && (
        <p className="bk-toast no-print" role="status" aria-live="polite">
          {toast}
        </p>
      )}

      {/* 新しいバージョンの案内（押したときだけ更新する） */}
      <PwaUpdatePrompt />
    </div>
  )
}
