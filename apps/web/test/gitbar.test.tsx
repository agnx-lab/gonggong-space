import type { BotDto, GroupBotStateDto, GroupDto, RepoStatus } from '@gonggong/protocol'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkbench } from '../src/app/workbench'
import { loadBotStates, useWorkspace } from '../src/app/workspace'
import { GitBar } from '../src/features/chat/GitBar'
import { mockApi } from './mockApi'
import { startRealtime } from './socket'

const group = (o: Partial<GroupDto> = {}): GroupDto => ({
  id: 'g1',
  teamId: 't1',
  name: '退款 v2 迁移',
  kind: 'group',
  mode: 'partition',
  adminOnlyInvite: false,
  protectBase: false,
  notice: '',
  noticeHidden: false,
  avatar: null,
  repo: { url: 'git@git.corp:pay/refund.git', branch: 'main' },
  members: [],
  botIds: ['b1', 'b2', 'b3', 'b4'],
  unread: 0,
  lastSeq: 0,
  last: '',
  pinned: false,
  muted: false,
  foldRuns: false,
  liveRunIds: [],
  liveRuns: [],
  ...o,
})

const bot = (id: string, name: string) => ({ id, name }) as BotDto

const state = (botId: string, o: Partial<GroupBotStateDto> = {}): GroupBotStateDto => ({
  botId,
  workspace: 'managed',
  path: null,
  state: 'ready',
  git: null,
  error: null,
  reason: null,
  tier: null,
  model: null,
  effort: null,
  context: null,
  extraDirs: [],
  ...o,
})

const git = (o: Partial<NonNullable<GroupBotStateDto['git']>> = {}) => ({
  branch: 'main',
  ahead: 0,
  behind: 0,
  dirty: false,
  workspace: 'managed' as const,
  repos: [],
  ...o,
})

beforeEach(() => {
  useWorkspace.setState({
    bots: [
      bot('b1', '小王的 Claude'),
      bot('b2', '老李的 Codex'),
      bot('b3', '阿杰的 Claude'),
      bot('b4', '小周的 Codex'),
    ],
    botStates: {},
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('git status bar', () => {
  it('loads the states and renders branch, behind/ahead, dirty, workspace kind and workspace hints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', { git: git({ branch: 'feat/refund-v2', ahead: 3, dirty: true }) }),
              state('b2', { state: 'cloning' }),
              state('b3', { state: 'failed', error: 'Permission denied (publickey)' }),
              state('b4', {
                workspace: 'cd',
                git: git({ branch: null, ahead: null, behind: null, workspace: 'cd' }),
              }),
            ]),
          ),
      ),
    )
    render(<GitBar group={group()} />)
    const b1 = await screen.findByTestId('git-b1')
    expect(fetch).toHaveBeenCalledWith('/api/groups/g1/bot-states', expect.anything())
    expect(b1.textContent).toBe('小王的 Claudefeat/refund-v23未提交托管')
    expect(within(b1).getByRole('img', { name: '领先 3 个提交' }).querySelector('svg')).toBeTruthy()
    expect(screen.getByTestId('git-b2').textContent).toBe('老李的 Codexclone 中…托管')
    expect(screen.getByTestId('git-b3').textContent).toBe('阿杰的 Claude工作区创建失败托管')
    expect(screen.getByText('工作区创建失败').getAttribute('title')).toBe('Permission denied (publickey)')
    expect(screen.getByTestId('git-b4').textContent).toBe('小周的 Codex—本机目录')
  })

  it('opens the bot workspace changes: uncommitted work first, else the branch against main', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', { git: git({ dirty: true }) }),
              state('b2', { git: git({ branch: 'feat/x', dirty: false }) }),
              state('b3', { state: 'cloning' }),
            ]),
          ),
      ),
    )
    useWorkbench.setState({ groupId: 'g1', benches: {} })
    render(<GitBar group={group({ botIds: ['b1', 'b2', 'b3'] })} />)
    fireEvent.click(await screen.findByRole('button', { name: '查看 小王的 Claude 的改动' }))
    const tabs = () => useWorkbench.getState().benches.g1?.tabs
    expect(tabs()).toEqual([{ kind: 'diff', botId: 'b1', scope: 'uncommitted', file: null }])
    fireEvent.click(screen.getByRole('button', { name: '查看 老李的 Codex 的改动' }))
    expect(tabs()?.at(-1)).toEqual({ kind: 'diff', botId: 'b2', scope: 'base', file: null })
    expect(
      (screen.getByRole('button', { name: '查看 阿杰的 Claude 的改动' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('expands where a bot works: repo, machine, copyable directory, base vs current branch, changes and extra dirs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T02:05:00.000Z'))
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    useWorkspace.setState({
      bots: [{ ...bot('b1', '小王的 Claude'), machineName: '王磊的 MacBook' }, bot('b2', '老李的 Codex')],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', {
                path: '/Users/w/.gonggong/workspaces/g1/b1/r1/refund',
                git: git({
                  branch: 'feat/x',
                  dirty: true,
                  dirtyCount: 3,
                  checkedAt: '2026-10-15T02:00:00.000Z',
                }),
                extraDirs: ['/Users/w/shared'],
              }),
              state('b2', { path: '/w/b2', git: git() }),
            ]),
          ),
      ),
    )
    render(<GitBar group={group({ botIds: ['b1', 'b2'] })} />)
    fireEvent.click(await screen.findByRole('button', { name: '小王的 Claude 的执行位置' }))
    const panel = await screen.findByRole('dialog', { name: '小王的 Claude 的执行位置' })
    expect(within(panel).getByText('git@git.corp:pay/refund.git')).toBeTruthy()
    expect(within(panel).getByText('王磊的 MacBook')).toBeTruthy()
    expect(within(panel).getByText('/Users/w/.gonggong/workspaces/g1/b1/r1/refund')).toBeTruthy()
    expect(within(panel).getByText('main')).toBeTruthy()
    expect(within(panel).getByText('feat/x').closest('[data-mismatch="true"]')).toBeTruthy()
    expect(within(panel).getByText('与基准分支不同')).toBeTruthy()
    expect(within(panel).getByText('3 个未提交 · 5 分钟前检查')).toBeTruthy()
    expect(within(panel).getByText('/Users/w/shared')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: '复制目录' }))
    expect(writeText).toHaveBeenCalledWith('/Users/w/.gonggong/workspaces/g1/b1/r1/refund')
    vi.useRealTimers()

    fireEvent.click(screen.getByRole('button', { name: '老李的 Codex 的执行位置' }))
    const other = await screen.findByRole('dialog', { name: '老李的 Codex 的执行位置' })
    expect(within(other).getByText('未绑定机器')).toBeTruthy()
    expect(within(other).queryByText('与基准分支不同')).toBeNull()
    expect(within(other).getByText('无未提交改动')).toBeTruthy()
    expect(within(other).queryByText('附加目录')).toBeNull()
  })

  it('opens the bot workspace files once the workspace exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', { git: git() }),
              state('b2', { state: 'ready' }),
              state('b3', { state: 'cloning' }),
            ]),
          ),
      ),
    )
    useWorkbench.setState({ groupId: 'g1', benches: {} })
    render(<GitBar group={group({ botIds: ['b1', 'b2', 'b3'] })} />)
    fireEvent.click(await screen.findByRole('button', { name: '浏览 小王的 Claude 的文件' }))
    const tabs = () => useWorkbench.getState().benches.g1?.tabs
    expect(tabs()).toEqual([{ kind: 'files', botId: 'b1', dir: '', selected: null }])
    fireEvent.click(screen.getByRole('button', { name: '浏览 老李的 Codex 的文件' }))
    expect(tabs()?.at(-1)).toEqual({ kind: 'files', botId: 'b2', dir: '', selected: null })
    expect(
      (screen.getByRole('button', { name: '浏览 阿杰的 Claude 的文件' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('shows 待创建 before the daemon reports and follows realtime updates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([]))),
    )
    render(<GitBar group={group({ botIds: ['b1'] })} />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByTestId('git-b1').textContent).toBe('小王的 Claude待创建托管')
    useWorkspace.getState().applyEvent({
      t: 'group.botState',
      groupId: 'g1',
      // A turn's git report counts even before a workspace.state arrives.
      state: state('b1', { state: 'pending', git: git({ behind: 2 }) }),
    })
    await waitFor(() => expect(screen.getByTestId('git-b1').textContent).toBe('小王的 Claudemain2托管'))
    expect(screen.getByRole('img', { name: '落后 2 个提交' })).toBeTruthy()
    useWorkspace
      .getState()
      .applyEvent({ t: 'group.botState', groupId: 'g1', state: state('b1', { state: 'unbound' }) })
    await waitFor(() => expect(screen.getByTestId('git-b1').textContent).toBe('小王的 Claude待绑定托管'))
  })

  it('loads once on the first connect and again after a reconnect', async () => {
    const calls = mockApi({ 'GET /groups/g1/bot-states': [] })
    const rt = startRealtime()
    render(<GitBar group={group({ botIds: ['b1'] })} />)
    await screen.findByText('待创建')
    await rt.open()
    expect(calls).toHaveLength(1)
    await rt.reconnect()
    expect(calls).toHaveLength(2)
  })

  it('summarizes sub-repos and opens the diff tab on the picked one', async () => {
    const sub = (path: string, o: Partial<RepoStatus> = {}): RepoStatus => ({
      path,
      kind: 'submodule',
      branch: 'main',
      ahead: 0,
      behind: 0,
      dirty: false,
      ...o,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', {
                git: git({
                  repos: [
                    sub('lib', { dirty: true }),
                    sub('vendor/x', { branch: null, ahead: 2, behind: 1 }),
                    sub('docs'),
                  ],
                }),
              }),
              state('b2', { git: git({ repos: [sub('lib')] }) }),
              // The root itself is not a repo: the summary stands in for the branch.
              state('b3', {
                git: git({ branch: null, ahead: null, behind: null, repos: [sub('a', { kind: 'nested' })] }),
              }),
            ]),
          ),
      ),
    )
    useWorkbench.setState({ groupId: 'g1', benches: {} })
    render(<GitBar group={group({ botIds: ['b1', 'b2', 'b3'] })} />)
    const b1 = await screen.findByTestId('git-b1')
    expect(within(b1).getByRole('button', { name: '+2 个子仓库有改动' })).toBeTruthy()
    expect(within(screen.getByTestId('git-b2')).getByRole('button', { name: '1 个子仓库' })).toBeTruthy()
    expect(screen.getByTestId('git-b3').textContent).toBe('阿杰的 Claude1 个子仓库托管')

    fireEvent.click(within(b1).getByRole('button', { name: '+2 个子仓库有改动' }))
    const pop = await screen.findByRole('dialog', { name: '小王的 Claude 的子仓库' })
    const lib = within(pop).getByRole('button', { name: /^lib/ })
    expect(lib.textContent).toBe('libmain未提交')
    const vendor = within(pop).getByRole('button', { name: /^vendor\/x/ })
    expect(vendor.textContent).toBe('vendor/x游离12')
    expect(within(vendor).getByRole('img', { name: '领先 2 个提交' })).toBeTruthy()

    fireEvent.click(lib)
    const tabs = () => useWorkbench.getState().benches.g1?.tabs
    expect(tabs()).toEqual([{ kind: 'diff', botId: 'b1', scope: 'uncommitted', file: null, repo: 'lib' }])
    fireEvent.click(within(b1).getByRole('button', { name: '+2 个子仓库有改动' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^vendor\/x/ }))
    expect(tabs()?.at(-1)).toEqual({ kind: 'diff', botId: 'b1', scope: 'base', file: null, repo: 'vendor/x' })
  })

  it('outside partition groups shows every bot with 执行位置; the context meter appears once known', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
    render(<GitBar group={group({ mode: 'force', botIds: ['b1', 'b2'] })} />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/groups/g1/bot-states', expect.anything()))
    expect(screen.getByRole('button', { name: '小王的 Claude 的执行位置' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '老李的 Codex 的执行位置' })).toBeTruthy()
    useWorkspace.getState().applyEvent({
      t: 'group.botState',
      groupId: 'g1',
      state: state('b2', { git: git(), context: { used: 50_000, size: 200_000 } }),
    })
    await waitFor(() => expect(screen.getByTestId('git-b2').textContent).toBe('老李的 Codex25%'))
    expect(screen.getByTestId('git-b1').textContent).toBe('小王的 Claude')
  })

  it('shows 执行位置 in a group without a repo: the repo row says so, branch and changes are hidden', async () => {
    useWorkspace.setState({ bots: [{ ...bot('b1', '小王的 Claude'), machineName: '王磊的 MacBook' }] })
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([state('b1', { path: '/w/b1', git: null })]))),
    )
    render(<GitBar group={group({ kind: 'dm', mode: 'force', repo: null, botIds: ['b1'] })} />)
    fireEvent.click(await screen.findByRole('button', { name: '小王的 Claude 的执行位置' }))
    const panel = await screen.findByRole('dialog', { name: '小王的 Claude 的执行位置' })
    expect(within(panel).getByText('未绑定仓库')).toBeTruthy()
    expect(within(panel).getByText('王磊的 MacBook')).toBeTruthy()
    expect(within(panel).getByText('/w/b1')).toBeTruthy()
    expect(within(panel).queryByText('分支')).toBeNull()
    expect(within(panel).queryByText('改动')).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: '复制目录' }))
    expect(writeText).toHaveBeenCalledWith('/w/b1')
  })
})

describe('context meter', () => {
  const posted = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === '/api/groups/g1/messages')
      .map(([, init]) => JSON.parse(String(init?.body)).body)

  it('shows the occupancy by level and offers /compact and /new for the bot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/bot-states')
          ? new Response(
              JSON.stringify([
                state('b1', { git: git(), context: { used: 124_000, size: 200_000 } }),
                state('b2', { git: git(), context: { used: 190_000, size: 200_000 } }),
                state('b3', { git: git(), context: { used: 800_000, size: 1_000_000 } }),
              ]),
            )
          : new Response(JSON.stringify({ id: 'm1' })),
      ),
    )
    render(<GitBar group={group({ botIds: ['b1', 'b2', 'b3'] })} />)
    const meter = await screen.findByRole('button', { name: '小王的 Claude 上下文 124k / 200k' })
    expect(meter.textContent).toBe('62%')
    expect(meter.dataset.level).toBe('normal')
    expect(screen.getByRole('button', { name: '老李的 Codex 上下文 190k / 200k' }).dataset.level).toBe(
      'critical',
    )
    expect(screen.getByRole('button', { name: '阿杰的 Claude 上下文 800k / 1M' }).dataset.level).toBe(
      'warning',
    )

    fireEvent.click(meter)
    fireEvent.click(await screen.findByRole('button', { name: '压缩上下文' }))
    await waitFor(() => expect(posted()).toEqual(['/compact @小王的 Claude']))
    fireEvent.click(meter)
    fireEvent.click(await screen.findByRole('button', { name: '开新对话' }))
    await waitFor(() => expect(posted()).toEqual(['/compact @小王的 Claude', '/new @小王的 Claude']))
  })

  it('counts down to auto-compaction and warns 20k before it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', { git: git(), context: { used: 50_000, size: 200_000, compactAt: 167_000 } }),
              state('b2', { git: git(), context: { used: 50_000, size: 200_000 } }),
              state('b3', { git: git(), context: { used: 150_000, size: 200_000, compactAt: 167_000 } }),
            ]),
          ),
      ),
    )
    render(<GitBar group={group({ botIds: ['b1', 'b2', 'b3'] })} />)
    const meter = await screen.findByRole('button', { name: '小王的 Claude 上下文 50k / 200k' })
    expect(meter.getAttribute('title')).toContain('还剩 117k 自动压缩')
    expect(meter.dataset.level).toBe('normal')
    expect(meter.querySelector('.ctx-meter__mark')).toBeTruthy()
    const other = screen.getByRole('button', { name: '老李的 Codex 上下文 50k / 200k' })
    expect(other.querySelector('.ctx-meter__mark')).toBeNull()
    // 75% of the window, past compactAt − 20k: warning, but never critical while the agent compacts by itself.
    expect(screen.getByRole('button', { name: '阿杰的 Claude 上下文 150k / 200k' }).dataset.level).toBe(
      'warning',
    )
    fireEvent.click(meter)
    expect(await screen.findByText(/还剩 117k 自动压缩/)).toBeTruthy()
    expect(screen.queryByText(/即将用满/)).toBeNull()
  })

  it('says the agent stops at blockAt when auto-compaction is off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              state('b1', { git: git(), context: { used: 100_000, size: 200_000, blockAt: 197_000 } }),
              state('b2', { git: git(), context: { used: 180_000, size: 200_000, blockAt: 197_000 } }),
            ]),
          ),
      ),
    )
    render(<GitBar group={group({ botIds: ['b1', 'b2'] })} />)
    const meter = await screen.findByRole('button', { name: '小王的 Claude 上下文 100k / 200k' })
    expect(meter.dataset.level).toBe('normal')
    expect(meter.querySelector('.ctx-meter__mark--block')).toBeTruthy()
    const full = screen.getByRole('button', { name: '老李的 Codex 上下文 180k / 200k' })
    expect(full.dataset.level).toBe('critical')
    fireEvent.click(full)
    expect(
      await screen.findByText(/已关闭自动压缩，用到 197k 时 Agent 会停下，需要手动压缩或开新对话/),
    ).toBeTruthy()
    expect(screen.getByText(/即将停下/)).toBeTruthy()
    expect(screen.queryByText(/自动压缩。$|Agent 会自动压缩/)).toBeNull()
  })

  it('sends what to keep along with /compact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/bot-states')
          ? new Response(
              JSON.stringify([state('b1', { git: git(), context: { used: 50_000, size: 200_000 } })]),
            )
          : new Response(JSON.stringify({ id: 'm1' })),
      ),
    )
    render(<GitBar group={group({ botIds: ['b1'] })} />)
    fireEvent.click(await screen.findByRole('button', { name: '小王的 Claude 上下文 50k / 200k' }))
    fireEvent.change(await screen.findByRole('textbox', { name: '压缩时保留的重点（可选）' }), {
      target: { value: '  保留接口设计 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '压缩上下文' }))
    await waitFor(() => expect(posted()).toEqual(['/compact 保留接口设计 @小王的 Claude']))
  })
})

describe('bot state store', () => {
  it('keeps states per group and merges realtime updates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([state('b1'), state('b2')]))),
    )
    await loadBotStates('g1')
    useWorkspace.getState().applyEvent({ t: 'group.botState', groupId: 'g2', state: state('b1') })
    useWorkspace.getState().applyEvent({
      t: 'group.botState',
      groupId: 'g1',
      state: state('b2', { state: 'failed', error: 'x' }),
    })
    const s = useWorkspace.getState().botStates
    expect(Object.keys(s)).toEqual(['g1', 'g2'])
    expect(s.g1?.b1?.state).toBe('ready')
    expect(s.g1?.b2).toEqual(state('b2', { state: 'failed', error: 'x' }))
  })
})
