import type { RunDetailDto, RunDto } from '@gonggong/protocol'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProcessView } from '../src/features/runs/ProcessView'
import type { Step } from '../src/features/runs/steps'
import { RunTab } from '../src/features/workbench/tabs/RunTab'

vi.mock('../src/lib/realtime', () => ({
  realtime: { subscribe: () => () => {}, onReconnect: () => () => {} },
}))
afterEach(() => vi.unstubAllGlobals())

const at = new Date(2026, 9, 18, 10, 0, 0).toISOString()
const cmd = (key: string, mono: string, o: Partial<Step> = {}): Step => ({
  key,
  kind: 'execute',
  label: '执行命令',
  mono,
  out: `$ ${mono}\nok`,
  at,
  ...o,
})
const steps: Step[] = [
  cmd('c1', 'make build'),
  { key: 'r1', kind: 'read', label: '读取文件', mono: 'src/a.ts', at },
  cmd('c2', 'make test', { failed: true, out: '$ make test\nboom' }),
  { key: 'aa1', kind: 'approval', label: '权限请求', mono: 'rm -rf dist', body: '已批准', at },
  { key: 't1', kind: 'text', label: '回复', body: '好了', at },
]

const rows = () => screen.getByRole('list', { name: '运行过程' }).querySelectorAll(':scope > li').length

describe('process filters', () => {
  it('narrows the process to failures, requests or commands', () => {
    render(<ProcessView steps={steps} root={null} live={false} startedAt={at} workedMs={1000} filterable />)
    const filters = screen.getByRole('group', { name: '筛选过程' })
    fireEvent.click(within(filters).getByRole('button', { name: '失败' }))
    expect(rows()).toBe(1)
    expect(screen.getByText('make test')).toBeTruthy()
    fireEvent.click(within(filters).getByRole('button', { name: '需处理' }))
    expect(rows()).toBe(1)
    expect(screen.getByText('rm -rf dist')).toBeTruthy()
    fireEvent.click(within(filters).getByRole('button', { name: '命令' }))
    expect(rows()).toBe(2)
    fireEvent.click(within(filters).getByRole('button', { name: '全部' }))
    expect(screen.getByText('好了')).toBeTruthy()
  })

  it('says so when nothing matches', () => {
    render(
      <ProcessView
        steps={steps.slice(0, 2)}
        root={null}
        live={false}
        startedAt={at}
        workedMs={null}
        filterable
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '失败' }))
    expect(screen.getByText('没有符合条件的步骤')).toBeTruthy()
  })
})

describe('long output', () => {
  it('searches and copies a command output', async () => {
    const out = [
      '$ make test',
      ...Array.from({ length: 30 }, (_, i) => (i === 3 ? 'FAIL boom' : `line ${i}`)),
    ].join('\n')
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(
      <ProcessView
        steps={[cmd('c1', 'make test', { failed: true, out })]}
        root={null}
        live={false}
        startedAt={at}
        workedMs={null}
      />,
    )
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索输出' }), { target: { value: 'boom' } })
    expect(screen.getByText('FAIL boom')).toBeTruthy()
    expect(screen.queryByText(/line 29/)).toBeNull()
    expect(screen.getByText('1 行匹配')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '复制输出' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(out))
  })
})

describe('following a live run', () => {
  it('offers a way back to the newest step once scrolled up', async () => {
    const run: RunDto = {
      id: 'r1',
      groupId: 'g1',
      botId: 'b1',
      triggerMessageId: 'm1',
      triggerUserId: 'u1',
      hop: 1,
      status: 'running',
      step: '',
      filesChanged: 0,
      usage: null,
      newSessionReason: null,
      queuedAt: at,
      startedAt: at,
      endedAt: null,
      parentRunId: null,
      hopMax: 3,
      offlineWaitMin: 30,
      originUserId: 'u1',
      questions: [],
      approvals: [],
      interrupt: null,
      stoppedBy: null,
      delegation: { subagents: 0, subagentsRunning: 0, tasksRunning: 0 },
      model: null,
      effort: null,
    }
    const d: RunDetailDto = {
      run,
      patch: null,
      purged: false,
      settings: null,
      patchRepos: [],
      sessionId: null,
      retentionDays: 30,
      events: [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = input.replace(/^\/api/, '').split('?')[0]
        if (path === '/runs/r1') return new Response(JSON.stringify(d))
        if (path === '/runs/r1/session') return new Response(JSON.stringify({ rounds: [] }))
        return new Response(
          JSON.stringify({ scope: 'turn', patch: null, base: null, branch: null, repos: [] }),
        )
      }),
    )
    render(<RunTab tab={{ kind: 'run', runId: 'r1', view: 'process', file: null }} tabKey="run:r1" active />)
    await screen.findByRole('list', { name: '运行过程' })
    const body = screen.getByTestId('run-tab').querySelector('.run-tab__body') as HTMLElement
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 200 })
    Object.defineProperty(body, 'scrollTop', { configurable: true, writable: true, value: 800 })
    expect(screen.queryByRole('button', { name: '回到最新' })).toBeNull()
    body.scrollTop = 100
    fireEvent.scroll(body)
    fireEvent.click(await screen.findByRole('button', { name: '回到最新' }))
    expect(body.scrollTop).toBe(1000)
    fireEvent.scroll(body)
    await waitFor(() => expect(screen.queryByRole('button', { name: '回到最新' })).toBeNull())
  })
})
