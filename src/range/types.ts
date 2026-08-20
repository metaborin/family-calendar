import type { ColumnId } from '../types'

/**
 * 期間予定（複数日にわたる終日予定）の型定義。
 *
 * 自由入力メモ・時間付き予定・毎週の定期予定とは別の種類として管理する。
 * 各日へ複製せず「開始日・終了日の1件」だけを保存し、
 * 表示のたびに表示中の月と重なる日を計算する。
 *
 * 期間予定に時刻は設定しない。
 * 時刻が必要な1日の予定には、従来どおり時間付き予定を使う。
 */
export type DateRangeEvent = {
  id: string
  columnId: ColumnId
  title: string
  /** "YYYY-MM-DD"（必須） */
  startDate: string
  /** "YYYY-MM-DD"（必須）。startDate 以降であること */
  endDate: string
}

/** 追加・編集ダイアログが扱う値 */
export type RangeEventDraft = {
  /** 既存の編集なら元のid、新規なら null */
  id: string | null
  columnId: ColumnId
  title: string
  startDate: string
  endDate: string
}

/**
 * ある1日・1件分の描画情報。
 *
 * 表のセルは rowspan で結合しない。
 * 日ごとに分割した部品を描き、目視で1本の帯につながって見えるようにする。
 */
export type RangeSegment = {
  event: DateRangeEvent
  /** 同じ列で重なった予定を横へずらすための番号（0が最も左） */
  lane: number
  /** 色パレットの番号（予定IDから決まるので月を移動しても変わらない） */
  paletteIndex: number
  /** 予定そのものの開始日か（上端を丸くする） */
  isStart: boolean
  /** 予定そのものの終了日か（下端を丸くする） */
  isEnd: boolean
  /** 表示中の月で最初に見える日か（ここに予定名を出す） */
  isFirstVisible: boolean
  /** 表示中の月で最後に見える日か（翌月への継続表示を出す） */
  isLastVisible: boolean
  /** 前月以前から続いているか */
  continuesFromPrevMonth: boolean
  /** 翌月以降へ続くか */
  continuesToNextMonth: boolean
}

/** 表示中の1か月分の描画情報 */
export type MonthRangeLayout = {
  /** 日（1〜月末） → 列ID → その日に描く部品 */
  segments: Map<number, Map<ColumnId, RangeSegment[]>>
  /** 列IDごとに、その月で必要になったレーン数（0なら期間予定なし） */
  laneCounts: Record<ColumnId, number>
  /** 同じ日・同じ列で重なった最大件数（多いときの注意表示に使う） */
  maxOverlap: number
}
