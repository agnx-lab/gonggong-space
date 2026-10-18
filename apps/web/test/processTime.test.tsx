import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fmtSpan, timeRange } from '../src/features/runs/activity'
import { ProcessView } from '../src/features/runs/ProcessView'
import type { Step } from '../src/features/runs/steps'
import { fullTime, hms, stamp } from '../src/lib/time'

const local = (d: number, h: number, m: number, s: number) => new Date(2026, 9, d, h, m, s).toISOString()

describe('process times', () => {
  it('formats clock times, full times and other days', () => {
    expect(hms(local(18, 9, 5, 7))).toBe('09:05:07')
    expect(fullTime(local(18, 9, 5, 7))).toBe('2026-10-18 09:05:07')
    expect(stamp(local(18, 23, 59, 1), local(18, 9, 0, 0))).toBe('23:59:01')
    expect(stamp(local(19, 0, 0, 3), local(18, 9, 0, 0))).toBe('10-19 00:00:03')
    expect(fmtSpan(800)).toBe('0.8 秒')
    expect(fmtSpan(12_300)).toBe('12.3 秒')
    expect(fmtSpan(65_000)).toBe('1 分 5 秒')
  })

  it('spans the earliest start to the latest end', () => {
    const steps: Step[] = [
      { key: 'a', kind: 'read', label: '', at: local(18, 10, 0, 5), end: local(18, 10, 0, 9) },
      { key: 'b', kind: 'read', label: '', at: local(18, 10, 0, 1) },
      { key: 'c', kind: 'read', label: '' },
    ]
    expect(timeRange(steps)).toEqual({ from: local(18, 10, 0, 1), to: local(18, 10, 0, 9) })
    expect(timeRange([{ key: 'c', kind: 'read', label: '' }])).toBeNull()
  })

  it('shows each row its time, a tooltip with the full time and duration, and groups their range', () => {
    const steps: Step[] = [
      {
        key: 'e1',
        kind: 'execute',
        label: '执行命令',
        mono: 'make build',
        out: 'ok',
        at: local(18, 10, 0, 1),
        end: local(18, 10, 0, 4),
      },
      { key: 'e2', kind: 'execute', label: '执行命令', mono: 'make test', at: local(18, 10, 0, 6) },
      { key: 'e3', kind: 'text', label: '回复', body: '好了', at: local(19, 0, 0, 2) },
      {
        key: 'e4',
        kind: 'subagent',
        label: '子 agent',
        title: '审查',
        body: '看代码',
        meta: '已完成',
        at: local(19, 0, 0, 3),
        end: local(19, 0, 1, 3),
        children: [],
      },
    ]
    render(<ProcessView steps={steps} root={null} live startedAt={local(18, 9, 0, 0)} workedMs={null} />)
    const group = screen.getByRole('button', { name: /运行了命令/ })
    expect(group.querySelector('time')?.textContent).toBe('10:00:01–10:00:06')
    fireEvent.click(group)
    const first = screen.getByText('make build').closest('.act-item')?.querySelector('time')
    expect(first?.textContent).toBe('10:00:01')
    expect(first?.getAttribute('title')).toBe('2026-10-18 10:00:01 · 耗时 3.0 秒')
    const sub = screen.getByText('审查').closest('.act-item')?.querySelector('time')
    expect(sub?.textContent).toBe('10-19 00:00:03–00:01:03')
    expect(sub?.getAttribute('title')).toBe('2026-10-19 00:00:03 – 2026-10-19 00:01:03 · 耗时 1 分')
    const reply = screen.getByText('好了').closest('.act-item')?.querySelector('time')
    expect(reply?.textContent).toBe('10-19 00:00:02')
  })
})
