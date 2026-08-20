import { createId } from '../events/dateUtils'
import type { DateRangeEvent, RangeEventDraft } from './types'

/** 追加・更新（元の配列は変更しない） */
export function applyRangeEventDraft(
  events: DateRangeEvent[],
  draft: RangeEventDraft,
): DateRangeEvent[] {
  const event: DateRangeEvent = {
    id: draft.id ?? createId(),
    columnId: draft.columnId,
    title: draft.title.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
  }
  if (draft.id === null) return [...events, event]
  return events.map((e) => (e.id === draft.id ? event : e))
}

export function removeRangeEvent(events: DateRangeEvent[], id: string): DateRangeEvent[] {
  return events.filter((e) => e.id !== id)
}
