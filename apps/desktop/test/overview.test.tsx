import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import './ipc-mock'
import { type DaemonStatus, ipc } from '../src/ipc'
import { OverviewPage } from '../src/pages/Overview'
import { mergeProcess } from '../src/pages/RunDetail'
import { useDaemon } from '../src/store'
import { bot, INFO, run, status } from './ipc-mock'

const m = vi.mocked(ipc)

function show(s: DaemonStatus) {
  useDaemon.setState({ info: INFO, snapshot: { phase: 'running', status: s } })
  return render(<OverviewPage go={() => {}} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  useDaemon.setState({ overview: null })
  m.tunnels.mockResolvedValue({ previews: [], services: [] })
  m.overview.mockResolvedValue({ workspaces: { count: 5, detail: '托管 4 · 本机目录 1 · 1.8 GB' } })
  m.bots.mockResolvedValue([
    bot({ presence: 'running' }),
    bot({
      id: 'b2',
      name: '小王的 Codex',
      agentKind: 'codex',
      binding: 'pending_confirm',
      presence: 'pending_confirm',
      concurrency: 1,
    }),
  ])
})

describe('overview', () => {
  it('points to 实时画面 when a live preview fails to publish', async () => {
    const go = vi.fn()
    m.tunnels.mockResolvedValue({
      services: [],
      previews: [
        {
          id: 'p1',
          kind: 'gui',
          title: '桌面客户端',
          groupName: '支付重构',
          botName: '小王的 Claude',
          port: null,
          path: '/',
          serviceId: null,
          serviceName: null,
          status: 'online',
          live: { state: 'failed', error: '找不到服务的窗口', missing: [] },
          control: null,
        },
      ],
    })
    useDaemon.setState({ info: INFO, snapshot: { phase: 'running', status: status() } })
    render(<OverviewPage go={go} />)
    const alert = (await screen.findByText('实时画面推流失败：桌面客户端')).closest(
      '[role="alert"]',
    ) as HTMLElement
    expect(within(alert).getByText('找不到服务的窗口')).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: '查看' }))
    expect(go).toHaveBeenCalledWith('live')
  })

  it('shows stats, running runs with their state and step, and the local queue', async () => {
    show(
      status({
        runs: [
          run({ runId: 'r1', status: 'awaiting_approval', step: '等待审批：go build ./...' }),
          run({
            runId: 'r2',
            groupName: '官网改版',
            status: null,
            step: '准备工作区',
            botId: 'b1',
            groupId: 'g2',
          }),
          run({ runId: 'r3', groupName: '支付服务重构', triggeredBy: '陈晨', queued: true }),
        ],
      }),
    )
    const stats = screen.getByTestId('stats')
    expect(within(stats).getByText('在线')).toBeTruthy()
    expect(within(stats).getByText('加密连接')).toBeTruthy()
    expect(await within(stats).findByText('1 已绑定')).toBeTruthy()
    expect(within(stats).getByText('Agent 可用 1 / 2')).toBeTruthy()
    expect(within(stats).getByText('2 / 2')).toBeTruthy()
    expect(within(stats).getByText('本机队列 1')).toBeTruthy()
    expect(await within(stats).findByText('5 个')).toBeTruthy()
    expect(within(stats).getByText('托管 4 · 本机目录 1 · 1.8 GB')).toBeTruthy()

    const running = screen.getByTestId('running')
    expect(within(running).getByText('等待审批')).toBeTruthy()
    expect(within(running).getByText('等待审批：go build ./...')).toBeTruthy()
    expect(within(running).getByText('准备中')).toBeTruthy()
    expect(within(running).getByText('官网改版 · 王磊 触发')).toBeTruthy()
    expect(screen.getByText('小王的 Claude · 支付服务重构 · 陈晨 触发 · 排第 1')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the last workspace count while it is counted again', async () => {
    m.overview.mockReturnValue(new Promise(() => {}))
    const first = show(status())
    expect(within(screen.getByTestId('stats')).getByText('统计中…')).toBeTruthy()
    first.unmount()
    useDaemon.setState({ overview: { workspaces: { count: 6, detail: '托管 2 · 本机目录 4 · 1.5 GB' } } })
    show(status())
    expect(within(screen.getByTestId('stats')).getByText('6 个')).toBeTruthy()
    expect(within(screen.getByTestId('stats')).getByText('托管 2 · 本机目录 4 · 1.5 GB')).toBeTruthy()
  })

  it('drills into a running run and shows its process, subagents included', async () => {
    const r1 = run({ runId: 'r1', status: 'running', step: 'Read' })
    m.runProcess.mockResolvedValueOnce({
      run: r1,
      endedMs: null,
      outcome: null,
      rev: 5,
      firstId: 1,
      events: [
        {
          id: 1,
          atMs: 1000,
          event: { kind: 'subagent', agentId: 'a1', name: 'Explore', task: '找调用方', state: 'running' },
        },
        { id: 2, atMs: 2000, event: { kind: 'text', delta: '子报告', agentId: 'a1' } },
        { id: 3, atMs: 3000, event: { kind: 'text', delta: '主进度' } },
      ],
    })
    m.runProcess.mockResolvedValue({
      run: r1,
      endedMs: null,
      outcome: null,
      rev: 7,
      firstId: 1,
      events: [
        { id: 3, atMs: 3000, event: { kind: 'text', delta: '主进度，继续' } },
        { id: 4, atMs: 4000, event: { kind: 'text', delta: '子报告二', agentId: 'a1' } },
      ],
    })
    show(status({ runs: [r1] }))
    fireEvent.click(within(screen.getByTestId('running')).getByRole('button', { name: /小王的 Claude/ }))
    expect(await screen.findByText('Explore')).toBeTruthy()
    expect(m.runProcess).toHaveBeenCalledWith('r1', null, null)
    expect(within(screen.getByTestId('activity-dock')).getByText('子 agent 1 个运行中')).toBeTruthy()
    expect(screen.getByText('找调用方')).toBeTruthy()
    expect(screen.getByText('子报告')).toBeTruthy()
    expect(screen.getByText('主进度')).toBeTruthy()

    expect(await screen.findByText('主进度，继续')).toBeTruthy()
    expect(m.runProcess).toHaveBeenNthCalledWith(2, 'r1', 3, 5)
    expect(screen.queryByText('主进度')).toBeNull()
    expect(screen.getByText('子报告')).toBeTruthy()
    expect(screen.getByText('子报告二')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByTestId('stats')).toBeTruthy()
  })

  it('merges each poll into the process shown so far', () => {
    const ev = (id: number, delta: string) => ({
      id,
      atMs: id * 1000,
      event: { kind: 'text' as const, delta },
    })
    const base = { run: run({ runId: 'r1' }), endedMs: null, outcome: null }
    const shown = { ...base, rev: 2, events: [ev(1, 'a'), ev(2, 'b'), ev(3, 'c')] }
    expect(mergeProcess(shown, { ...base, rev: 2, firstId: 1, events: [] })).toBe(shown)
    expect(
      mergeProcess(shown, { ...base, rev: 3, firstId: 2, events: [ev(3, 'cd'), ev(4, 'e')] })?.events,
    ).toEqual([ev(2, 'b'), ev(3, 'cd'), ev(4, 'e')])
    const ended = mergeProcess(shown, {
      ...base,
      endedMs: 9000,
      outcome: 'completed',
      rev: 4,
      firstId: 1,
      events: [],
    })
    expect(ended).toMatchObject({ endedMs: 9000, outcome: 'completed', rev: 4, events: shown.events })
    expect(mergeProcess(undefined, { ...base, rev: 1, firstId: 5, events: [ev(5, 'x')] })?.events).toEqual([
      ev(5, 'x'),
    ])
    expect(mergeProcess(shown, null)).toBeNull()
  })

  it('warns while offline with the next retry', () => {
    show(status({ conn: { state: 'offline', retryAtMs: Date.now() + 16_000, error: 'refused' } }))
    expect(screen.getByRole('alert').textContent).toMatch(/服务器不可用 · 指数退避重连中（下次 1[56] 秒后）/)
    expect(screen.getByText('当前没有运行中的轮次')).toBeTruthy()
    expect(screen.getByText('本机队列为空')).toBeTruthy()
  })

  it('explains a protocol rejection', () => {
    show(status({ conn: { state: 'rejected', reason: 'protocol', message: '需要协议 v2', wiped: [] } }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('协议版本不兼容 · 服务器拒绝连接')
    expect(alert.textContent).toContain('本机 daemon v0.1.0 使用协议 v1')
    expect(alert.textContent).toContain('需要协议 v2')
  })

  it('reports what a revocation wiped and offers to bind again', () => {
    show(
      status({
        conn: {
          state: 'rejected',
          reason: 'revoked',
          message: 'machine token revoked',
          wiped: [
            '/Users/wl/.gonggong/workspaces/g1',
            '/Users/wl/.gonggong/workspaces/g2',
            '/Users/wl/.gonggong/config.json',
          ],
        },
      }),
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('token 已被吊销 · 账号已停用')
    expect(alert.textContent).toContain('已清除本机团队密钥与 2 个托管工作区')
    expect(within(alert).getByRole('button', { name: '重新绑定' })).toBeTruthy()
  })
})
