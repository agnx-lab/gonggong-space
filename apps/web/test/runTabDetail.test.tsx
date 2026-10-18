import type { RunDetailDto, RunDto } from '@gonggong/protocol'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunTab } from '../src/features/workbench/tabs/RunTab'

vi.mock('../src/lib/realtime', () => ({
  realtime: { subscribe: () => () => {}, onReconnect: () => () => {} },
}))

const local = (h: number, m: number, s: number) => new Date(2026, 9, 18, h, m, s).toISOString()
const run = (o: Partial<RunDto> = {}): RunDto => ({
  id: 'r1',
  groupId: 'g1',
  botId: 'b1',
  triggerMessageId: 'm1',
  triggerUserId: 'u1',
  hop: 1,
  status: 'completed',
  step: '',
  filesChanged: 0,
  usage: null,
  newSessionReason: null,
  queuedAt: local(10, 0, 0),
  startedAt: local(10, 0, 1),
  endedAt: local(10, 3, 20),
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
  ...o,
})
const detail = (r: RunDto, events: RunDetailDto['events'] = []): RunDetailDto => ({
  run: r,
  patch: null,
  purged: false,
  settings: null,
  patchRepos: [],
  sessionId: null,
  retentionDays: 30,
  events,
})

function serve(d: RunDetailDto) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const path = input.replace(/^\/api/, '').split('?')[0]
      if (path === '/runs/r1') return new Response(JSON.stringify(d))
      if (path === '/runs/r1/session') return new Response(JSON.stringify({ rounds: [] }))
      return new Response(JSON.stringify({ scope: 'turn', patch: null, base: null, branch: null, repos: [] }))
    }),
  )
}
afterEach(() => vi.unstubAllGlobals())

const props = {
  tab: { kind: 'run' as const, runId: 'r1', view: 'process' as const, file: null },
  tabKey: 'run:r1',
  active: true,
}

describe('run tab detail', () => {
  it('shows when the run started and ended', async () => {
    serve(detail(run()))
    render(<RunTab {...props} />)
    const span = await screen.findByTitle('开始 – 结束')
    expect(span.textContent).toBe('10:00:01 – 10:03:20')
  })

  it('shows a running run as started, still going', async () => {
    serve(detail(run({ status: 'running', endedAt: null })))
    render(<RunTab {...props} />)
    expect((await screen.findByTitle('开始 – 结束')).textContent).toBe('10:00:01 – 进行中')
  })
})
