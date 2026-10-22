import type { TimelineBlock } from '@gonggong/protocol'
import { Icon, type IconName } from '../../ui'

type Status = NonNullable<TimelineBlock[number]['status']>
const ICON: Record<Status, IconName> = {
  done: 'checkmark-circle',
  running: 'arrow-clockwise',
  pending: 'clock',
  failed: 'xmark-circle',
}

/** ```timeline: entries top to bottom on a vertical rail, each marked by its status. */
export function Timeline({ data }: { data: TimelineBlock }) {
  return (
    <ol className="rich-timeline">
      {data.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: entries are positional
        <li key={i} className="rich-timeline__item" data-status={e.status}>
          <span className="rich-timeline__mark">
            {e.status ? <Icon name={ICON[e.status]} size={14} /> : null}
          </span>
          <span className="rich-timeline__time">{e.time}</span>
          <span className="rich-timeline__title">{e.title}</span>
          {e.detail ? <span className="rich-timeline__detail">{e.detail}</span> : null}
        </li>
      ))}
    </ol>
  )
}
