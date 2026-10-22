import type { ChartBlock } from '@gonggong/protocol'
import type { EChartsCoreOption } from 'echarts/core'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { token, useDark } from './theme'

const PALETTE = [
  'blue',
  'green',
  'orange',
  'purple',
  'teal',
  'pink',
  'indigo',
  'yellow',
  'red',
  'cyan',
  'mint',
  'brown',
]

/** ECharts option for a block, coloured with the current design tokens. */
export function chartOption(c: ChartBlock): EChartsCoreOption {
  const label = token('--label')
  const secondary = token('--label-secondary')
  const separator = token('--separator')
  const pie = c.type === 'pie'
  const unit = c.unit ?? ''
  const top = (c.title ? 32 : 0) + (pie || c.series.length > 1 ? 28 : 0) + 8
  const axisLabel = { color: secondary }
  return {
    backgroundColor: 'transparent',
    color: PALETTE.map((p) => token(`--system-${p}`)),
    textStyle: { fontFamily: token('--font-sans') },
    title: c.title
      ? { text: c.title, textStyle: { color: label, fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: {
      trigger: pie ? 'item' : 'axis',
      valueFormatter: (v: unknown) => (v === null || v === undefined ? '-' : `${v}${unit}`),
    },
    legend: { show: pie || c.series.length > 1, top: c.title ? 28 : 0, textStyle: { color: secondary } },
    ...(pie
      ? {
          series: [
            {
              type: 'pie',
              name: c.series[0]?.name,
              top,
              radius: ['40%', '70%'],
              label: { color: label },
              data: c.x.map((name, i) => ({ name: String(name), value: c.series[0]?.data[i] ?? 0 })),
            },
          ],
        }
      : {
          grid: { top, left: 8, right: 16, bottom: 8 },
          xAxis: {
            type: 'category',
            data: c.x.map(String),
            boundaryGap: c.type === 'bar' || c.type === 'scatter',
            axisLine: { lineStyle: { color: separator } },
            axisLabel,
          },
          yAxis: {
            type: 'value',
            axisLabel: { ...axisLabel, formatter: `{value}${unit}` },
            splitLine: { lineStyle: { color: separator } },
          },
          series: c.series.map((s) => ({
            name: s.name,
            type: c.type === 'area' ? 'line' : c.type,
            data: s.data,
            stack: c.stacked ? 'total' : undefined,
            areaStyle: c.type === 'area' ? { opacity: 0.18 } : undefined,
            showSymbol: c.x.length <= 30,
          })),
        }),
  }
}

/** ```chart: ECharts, fetched on first use; hover shows values, the legend toggles series. */
export function Chart({ data, fallback }: { data: ChartBlock; fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const dark = useDark()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let gone = false
    let dispose = () => {}
    import('./echarts')
      .then(({ init }) => {
        const el = box.current
        if (gone || !el) return
        // The dark theme's tooltips and axis pointers; colours and background come from the option.
        const chart = init(el, dark ? 'dark' : undefined)
        chart.setOption(chartOption(data))
        const ro = new ResizeObserver(() => chart.resize())
        ro.observe(el)
        dispose = () => {
          ro.disconnect()
          chart.dispose()
        }
      })
      .catch(() => !gone && setFailed(true))
    return () => {
      gone = true
      dispose()
    }
  }, [data, dark])
  if (failed) return fallback
  return <div ref={box} className="rich-chart" role="img" aria-label={data.title ?? t('图表')} />
}
