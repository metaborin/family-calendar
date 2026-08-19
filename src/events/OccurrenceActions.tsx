import Dialog from './Dialog'
import type { WeeklyRecurringRule } from './types'
import { formatDateKeyJa, formatTimeRange } from './dateUtils'

type Props = {
  rule: WeeklyRecurringRule
  dateKey: string
  targetName: string
  onSkipThisDay: () => void
  onEditRule: () => void
  onClose: () => void
}

/** 定期予定の発生日を押したときに出す小さな選択ダイアログ */
export default function OccurrenceActions({
  rule,
  dateKey,
  targetName,
  onSkipThisDay,
  onEditRule,
  onClose,
}: Props) {
  const time = formatTimeRange(rule.startTime, rule.endTime)

  return (
    <Dialog
      title="定期予定"
      onClose={onClose}
      footer={
        <>
          <span className="ev-footer-spacer" />
          <button type="button" className="ev-button" onClick={onClose}>
            閉じる
          </button>
        </>
      }
    >
      <p className="ev-occurrence__summary">
        {formatDateKeyJa(dateKey)}／{targetName}
        <br />
        <strong>
          {time && `${time} `}
          {rule.title}
        </strong>
      </p>

      <div className="ev-occurrence__actions">
        <button type="button" className="ev-button ev-button--primary" onClick={onSkipThisDay}>
          この日だけ休みにする
        </button>
        <button type="button" className="ev-button" onClick={onEditRule}>
          定期予定を編集する
        </button>
      </div>

      <p className="ev-hint">
        「この日だけ休みにする」を選んでも、定期予定そのものは削除されません。
        あとで定期予定の編集画面から元に戻せます。
      </p>
      <p className="ev-hint">
        この日だけ時間を変えたい場合は、いったん休みにしてから、
        その日に別の予定を追加してください。
      </p>
    </Dialog>
  )
}
