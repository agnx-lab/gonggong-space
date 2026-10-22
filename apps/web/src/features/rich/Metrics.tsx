import type { MetricsBlock } from '@gonggong/protocol'
import { Sparkline } from '../../ui/chart'

/** ```metrics: a row of stat tiles that wraps on narrow screens. */
export function Metrics({ data }: { data: MetricsBlock }) {
  return (
    <div className="rich-metrics">
      {data.map((m, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tiles are positional and may share a label
        <div key={i} className="rich-metric">
          <span className="rich-metric__label">{m.label}</span>
          <span className="rich-metric__value">
            {m.value}
            {m.unit ? <small>{m.unit}</small> : null}
          </span>
          <span className="rich-metric__foot">
            {m.delta === undefined ? null : (
              <span className="rich-metric__delta" data-tone={m.tone ?? 'neutral'}>
                {typeof m.delta === 'number' && m.delta > 0 ? `+${m.delta}` : m.delta}
              </span>
            )}
            {m.trend && m.trend.length > 1 ? <Sparkline values={m.trend} width={72} height={22} /> : null}
          </span>
        </div>
      ))}
    </div>
  )
}
