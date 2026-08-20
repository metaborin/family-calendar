import { COLUMN_IDS, type ColumnId } from '../types'
import { toDateKey } from '../events/dateUtils'
import type { DateRangeEvent, MonthRangeLayout, RangeSegment } from './types'

/**
 * 期間予定の色と、重なったときのレーン計算。
 *
 * 色は予定IDから決まるため、月を移動しても再読み込みしても変わらない。
 * localStorageへ色を保存する必要はない。
 */

export type RangePalette = {
  /** 縦帯の色（濃いめ。白黒印刷でも線として判別できる明るさ） */
  band: string
  /** 予定名ラベルの薄い背景 */
  soft: string
  /** 予定名ラベルの文字色（soft に対して 4.5:1 以上） */
  text: string
  /** 読み上げ・title には使わない、開発用の呼び名 */
  name: string
}

/**
 * 落ち着いた6色。派手な原色は使わない。
 * 文字色とラベル背景のコントラスト比はすべて 6.3:1 以上ある。
 */
export const RANGE_PALETTE: RangePalette[] = [
  { name: '青灰', band: '#4a6b8a', soft: '#eef2f7', text: '#33506b' },
  { name: '緑', band: '#4c7a55', soft: '#eef4ef', text: '#345639' },
  { name: '紫', band: '#6d5a91', soft: '#f1eef7', text: '#4d3f6b' },
  { name: '橙', band: '#9c6a35', soft: '#f8f1e8', text: '#77501f' },
  { name: '藍緑', band: '#3f7480', soft: '#ecf3f5', text: '#2c5560' },
  { name: '赤茶', band: '#8b5058', soft: '#f7eef0', text: '#6b3a41' },
]

/**
 * 予定IDから色番号を決める。
 * 同じIDなら必ず同じ色になり、月の移動・再読み込みでも変わらない。
 */
export function paletteIndexFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    // 32bit の範囲で回す簡単なハッシュ（暗号用途ではない）
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % RANGE_PALETTE.length
}

/** 並び順を固定する（開始日 → 終了日 → ID） */
export function compareRangeEvents(a: DateRangeEvent, b: DateRangeEvent): number {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
  if (a.endDate !== b.endDate) return a.endDate < b.endDate ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 同じ列の期間予定へレーン番号を割り当てる。
 *
 * 重なっていない最も小さい番号を使い、重ならない予定ではレーンを再利用する。
 * 表示中の月だけでなく全期間で計算するため、月を移動してもレーンが入れ替わらない。
 * レーン数は固定で制限しない（必要な分だけ増やす）。
 */
export function assignLanes(events: DateRangeEvent[]): Map<string, number> {
  const lanes = new Map<string, number>()
  const sorted = [...events].sort(compareRangeEvents)
  /** レーンごとの「現在使用中の最終日」 */
  const laneEnds: string[] = []

  for (const event of sorted) {
    let lane = laneEnds.findIndex((end) => end < event.startDate)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(event.endDate)
    } else {
      laneEnds[lane] = event.endDate
    }
    lanes.set(event.id, lane)
  }

  return lanes
}

const emptyLaneCounts = (): Record<ColumnId, number> => ({
  everyone: 0,
  member1: 0,
  member2: 0,
  member3: 0,
  member4: 0,
  member5: 0,
})

/**
 * 表示中の月について、日ごとの描画情報を組み立てる。
 *
 * 日付キーは "YYYY-MM-DD" の文字列比較で判定する。
 * ゼロ埋めされているため辞書順＝日付順になり、
 * UTC変換による日付ずれが起きない（Date を日付キーの解釈に使わない）。
 */
export function buildMonthRangeLayout(
  events: DateRangeEvent[],
  year: number,
  month: number,
  dayCount: number,
): MonthRangeLayout {
  const segments: MonthRangeLayout['segments'] = new Map()
  const laneCounts = emptyLaneCounts()
  let maxOverlap = 0

  if (events.length === 0) return { segments, laneCounts, maxOverlap }

  const monthFirst = toDateKey(year, month, 1)
  const monthLast = toDateKey(year, month, dayCount)

  for (const columnId of COLUMN_IDS) {
    const inColumn = events.filter((e) => e.columnId === columnId)
    if (inColumn.length === 0) continue

    const lanes = assignLanes(inColumn)

    // 表示中の月と少しでも重なる予定だけを描く
    const visible = inColumn
      .filter((e) => e.startDate <= monthLast && e.endDate >= monthFirst)
      .sort(compareRangeEvents)
    if (visible.length === 0) continue

    let usedLanes = 0

    for (const event of visible) {
      const lane = lanes.get(event.id) ?? 0
      if (lane + 1 > usedLanes) usedLanes = lane + 1

      const paletteIndex = paletteIndexFor(event.id)
      const firstVisible = event.startDate < monthFirst ? monthFirst : event.startDate
      const lastVisible = event.endDate > monthLast ? monthLast : event.endDate

      for (let day = 1; day <= dayCount; day++) {
        const dateKey = toDateKey(year, month, day)
        if (dateKey < firstVisible || dateKey > lastVisible) continue

        let byColumn = segments.get(day)
        if (!byColumn) {
          byColumn = new Map()
          segments.set(day, byColumn)
        }
        const list = byColumn.get(columnId)
        const segment: RangeSegment = {
          event,
          lane,
          paletteIndex,
          isStart: dateKey === event.startDate,
          isEnd: dateKey === event.endDate,
          isFirstVisible: dateKey === firstVisible,
          isLastVisible: dateKey === lastVisible,
          continuesFromPrevMonth: event.startDate < monthFirst,
          continuesToNextMonth: event.endDate > monthLast,
        }
        if (list) {
          list.push(segment)
          if (list.length > maxOverlap) maxOverlap = list.length
        } else {
          byColumn.set(columnId, [segment])
          if (maxOverlap < 1) maxOverlap = 1
        }
      }
    }

    laneCounts[columnId] = usedLanes
  }

  // 同じ列の中では、常にレーン番号順に描く
  for (const byColumn of segments.values()) {
    for (const list of byColumn.values()) list.sort((a, b) => a.lane - b.lane)
  }

  return { segments, laneCounts, maxOverlap }
}

/* --- 画面・印刷での横位置（CSSと必ず同じ値を使う） --- */

/** 画面：1本目の左端(px) */
export const LANE_LEFT_PX = 4
/** 画面：レーンごとの間隔(px)。帯4px＋すき間2px */
export const LANE_PITCH_PX = 6
/** 画面：クリックしやすい幅(px)。見た目の帯より広く取る */
export const LANE_HIT_WIDTH_PX = 18

/** 印刷：1本目の左端(mm) */
export const LANE_LEFT_MM = 0.4
/** 印刷：レーンごとの間隔(mm) */
export const LANE_PITCH_MM = 1.0

/** 画面で予定文字を帯の右へ逃がすための余白(px) */
export function screenGutterPx(laneCount: number): number {
  if (laneCount <= 0) return 0
  // 一番右のレーンのクリック領域までを確実に確保する
  return LANE_LEFT_PX + (laneCount - 1) * LANE_PITCH_PX + LANE_HIT_WIDTH_PX + 2
}

/** 印刷で予定文字を帯の右へ逃がすための余白(mm) */
export function printGutterMm(laneCount: number): number {
  if (laneCount <= 0) return 0
  return LANE_LEFT_MM + laneCount * LANE_PITCH_MM + 0.3
}
