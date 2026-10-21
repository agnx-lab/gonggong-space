import type {
  BotDto,
  GitOperationDto,
  GitRefsDto,
  GroupBotStateDto,
  GroupDto,
  UserDto,
} from '@gonggong/protocol'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../src/app/session'
import { useWorkbench } from '../src/app/workbench'
import { useWorkspace } from '../src/app/workspace'
import { GitBar } from '../src/features/chat/GitBar'
import { LinkedGitOperation } from '../src/features/git/GitOperations'
import { useToasts } from '../src/ui'
import { apiError, mockApi } from './mockApi'

const group = (o: Partial<GroupDto> = {}): GroupDto => ({
  id: 'g1',
  teamId: 't1',
  name: '退款 v2 迁移',
  kind: 'group',
  mode: 'partition',
  adminOnlyInvite: false,
  protectBase: true,
  notice: '',
  noticeHidden: false,
  avatar: null,
  repo: { url: 'git@git.corp:pay/refund.git', branch: 'main' },
  members: [],
  botIds: ['b1'],
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

const state = (o: Partial<GroupBotStateDto> = {}): GroupBotStateDto => ({
  botId: 'b1',
  workspace: 'managed',
  path: '/w/b1',
  state: 'ready',
  git: {
    branch: 'feat/refund-v2',
    ahead: 3,
    behind: 0,
    dirty: true,
    dirtyCount: 3,
    workspace: 'managed',
    repos: [],
  },
  error: null,
  reason: null,
  tier: null,
  model: null,
  effort: null,
  context: null,
  extraDirs: [],
  ...o,
})

const branch = (name: string, o: Partial<GitRefsDto['branches'][number]> = {}) => ({
  name,
  kind: 'local' as const,
  current: false,
  upstream: null,
  ahead: null,
  behind: null,
  commit: 'abc',
  subject: 's',
  at: '2026-10-20T00:00:00.000Z',
  ...o,
})

const REFS: GitRefsDto = {
  branches: [
    branch('main', { upstream: 'origin/main', ahead: 0, behind: 2 }),
    branch('feat/refund-v2', { current: true, upstream: 'origin/feat/refund-v2', ahead: 3, behind: 0 }),
    branch('origin/main', { kind: 'remote' }),
    branch('origin/feat/pay', { kind: 'remote' }),
  ],
  remotes: [{ name: 'origin', url: 'git@git.corp:pay/refund.git' }],
}

const op = (o: Partial<GitOperationDto> = {}): GitOperationDto => ({
  id: 'op1',
  groupId: 'g1',
  botId: 'b1',
  action: 'push',
  branch: 'main',
  remote: 'origin',
  message: null,
  pushesBase: true,
  status: 'pending_approval',
  requestedBy: { id: 'u2', name: '老李' },
  decidedBy: null,
  output: null,
  error: null,
  createdAt: '2026-10-21T00:00:00.000Z',
  expiresAt: '2026-10-22T00:00:00.000Z',
  finishedAt: null,
  ...o,
})

const BASE = '/groups/g1/bots/b1/git'

const setMe = (id: string) => useSession.setState({ user: { id, name: id } as UserDto })

beforeEach(() => {
  setMe('u1')
  useWorkspace.setState({
    bots: [{ id: 'b1', name: '小王的 Claude', ownerId: 'u1', ownerName: '小王' } as BotDto],
    botStates: {},
    gitOps: {},
  })
  useWorkbench.setState({ groupId: 'g1', benches: {} })
  useToasts.setState({ items: [] })
})
afterEach(() => vi.unstubAllGlobals())

const routes = (extra: Record<string, unknown> = {}) => ({
  'GET /groups/g1/bot-states': [state()],
  'GET /groups/g1/git/operations': { operations: [] },
  [`GET ${BASE}/refs`]: REFS,
  ...extra,
})
const toasts = () => useToasts.getState().items.map((t) => t.message)
const actions = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '小王的 Claude 的 Git 操作' }))
  return within(await screen.findByRole('dialog', { name: '小王的 Claude 的 Git 操作' }))
}

describe('branch switcher', () => {
  it('groups local and remote branches, searches, lists remotes and checks out after confirming', async () => {
    const calls = mockApi(
      routes({
        [`POST ${BASE}/actions`]: op({
          action: 'checkout',
          status: 'succeeded',
          pushesBase: false,
          requestedBy: { id: 'u1', name: '小王' },
        }),
      }),
    )
    render(<GitBar group={group()} />)
    const trigger = await screen.findByRole('button', { name: '切换 小王的 Claude 的分支' })
    expect(trigger.textContent).toBe('feat/refund-v2')
    fireEvent.click(trigger)
    const pop = within(await screen.findByRole('dialog', { name: '小王的 Claude 的分支' }))
    const local = within(await pop.findByRole('group', { name: '本地' }))
    const remote = within(pop.getByRole('group', { name: '远程' }))
    expect(local.getAllByRole('button').map((b) => b.dataset.ref)).toEqual(['main', 'feat/refund-v2'])
    expect(remote.getAllByRole('button').map((b) => b.dataset.ref)).toEqual([
      'origin/main',
      'origin/feat/pay',
    ])
    expect(
      within(local.getByRole('button', { name: /^main/ })).getByRole('img', { name: '落后 2 个提交' }),
    ).toBeTruthy()
    const current = local.getByRole('button', { name: /^feat\/refund-v2/ })
    expect(current.getAttribute('aria-current')).toBe('true')
    expect(within(current).getByRole('img', { name: '领先 3 个提交' })).toBeTruthy()
    expect(pop.getByText('git@git.corp:pay/refund.git')).toBeTruthy()

    fireEvent.change(pop.getByRole('searchbox', { name: '搜索分支' }), { target: { value: 'pay' } })
    expect(pop.queryByRole('group', { name: '本地' })).toBeNull()
    fireEvent.click(pop.getByRole('button', { name: /origin\/feat\/pay/ }))

    const confirm = within(await screen.findByRole('dialog', { name: '切换分支' }))
    expect(confirm.getByText(/feat\/pay/)).toBeTruthy()
    fireEvent.click(confirm.getByRole('button', { name: '切换' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')).toEqual({
        method: 'POST',
        path: `${BASE}/actions`,
        body: { action: 'checkout', branch: 'origin/feat/pay' },
      }),
    )
    await waitFor(() => expect(toasts()).toContain('小王的 Claude：切换分支完成'))
  })
})

describe('git actions', () => {
  it('pulls, and commits with the message, showing the uncommitted count', async () => {
    const calls = mockApi(
      routes({
        [`POST ${BASE}/actions`]: (b: { action: string }) =>
          op({ action: b.action as 'pull', status: 'succeeded' }),
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '拉取' }))
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([{ action: 'pull' }]),
    )

    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    const dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(dialog.getByText('3 个未提交文件')).toBeTruthy()
    const submit = dialog.getByRole('button', { name: '提交' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(dialog.getByRole('textbox', { name: '提交说明' }), { target: { value: '修复退款' } })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
        { action: 'pull' },
        { action: 'commit', message: '修复退款' },
      ]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '提交改动' })).toBeNull())
  })

  it('keeps the commit dialog open when git fails, with its reason', async () => {
    mockApi(
      routes({
        [`POST ${BASE}/actions`]: () =>
          op({
            id: 'op-fail',
            action: 'commit',
            status: 'failed',
            error: '没有可提交的改动',
            requestedBy: { id: 'u1', name: '王磊' },
          }),
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    const dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    fireEvent.change(dialog.getByRole('textbox', { name: '提交说明' }), { target: { value: '修复退款' } })
    fireEvent.click(dialog.getByRole('button', { name: '提交' }))
    await waitFor(() => expect(toasts()).toContain('没有可提交的改动'))
    expect(screen.getByRole('dialog', { name: '提交改动' })).toBeTruthy()
  })

  it('pushes to the current branch, and asks for a second confirmation for the protected base', async () => {
    const calls = mockApi(routes({ [`POST ${BASE}/actions`]: op({ status: 'succeeded' }) }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '推送…' }))
    let dialog = within(await screen.findByRole('dialog', { name: '推送' }))
    expect((dialog.getByRole('textbox', { name: '分支' }) as HTMLInputElement).value).toBe('feat/refund-v2')
    expect(await dialog.findByRole('button', { name: '远程' })).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: '推送' }))
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.body)).toEqual([
        { action: 'push', remote: 'origin', branch: 'feat/refund-v2', confirmBase: false },
      ]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '推送' })).toBeNull())

    fireEvent.click((await actions()).getByRole('button', { name: '推送…' }))
    dialog = within(await screen.findByRole('dialog', { name: '推送' }))
    fireEvent.change(dialog.getByRole('textbox', { name: '分支' }), { target: { value: 'main' } })
    expect(dialog.getByText(/main 是受保护的基准分支/)).toBeTruthy()
    const push = dialog.getByRole('button', { name: '推送' }) as HTMLButtonElement
    expect(push.disabled).toBe(true)
    fireEvent.click(dialog.getByRole('checkbox', { name: '我确认推送到基准分支' }))
    fireEvent.click(push)
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'POST').at(-1)?.body).toEqual({
        action: 'push',
        remote: 'origin',
        branch: 'main',
        confirmBase: true,
      }),
    )
  })

  it("tells a non-owner the request waits for the owner's approval", async () => {
    setMe('u2')
    useWorkspace.setState({
      bots: [{ id: 'b1', name: '小王的 Claude', ownerId: 'u1', ownerName: '小王' } as BotDto],
    })
    mockApi(routes({ [`POST ${BASE}/actions`]: op({ action: 'pull', status: 'pending_approval' }) }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '拉取' }))
    await waitFor(() => expect(toasts()).toContain('已提交申请，等待 Bot 主人 小王 审批'))
  })

  it('shows the server message when the bot is busy', async () => {
    mockApi(
      routes({ [`POST ${BASE}/actions`]: apiError(409, 'conflict', '小王的 Claude 正在运行，请稍后再试') }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '拉取' }))
    await waitFor(() => expect(toasts()).toContain('小王的 Claude 正在运行，请稍后再试'))
  })

  it('opens the commit history in the workbench', async () => {
    mockApi(routes())
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交历史' }))
    expect(useWorkbench.getState().benches.g1?.tabs).toEqual([
      { kind: 'git-log', botId: 'b1', ref: null, commit: null },
    ])
  })

  it('stays hidden outside partition groups with a repo', async () => {
    mockApi(routes())
    render(<GitBar group={group({ mode: 'force' })} />)
    await screen.findByTestId('git-b1')
    expect(screen.queryByRole('button', { name: '小王的 Claude 的 Git 操作' })).toBeNull()
    expect(screen.queryByRole('button', { name: '切换 小王的 Claude 的分支' })).toBeNull()
  })
})

describe('git operation approvals', () => {
  it('badges pending requests; the owner approves or rejects them', async () => {
    const calls = mockApi(
      routes({
        'GET /groups/g1/git/operations': {
          operations: [
            op(),
            op({
              id: 'op2',
              action: 'commit',
              branch: null,
              remote: null,
              message: '修复',
              pushesBase: false,
            }),
          ],
        },
        'POST /git-operations/op1/decide': op({ status: 'succeeded' }),
        'POST /git-operations/op2/decide': op({ id: 'op2', status: 'rejected' }),
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click(await screen.findByRole('button', { name: '待审批 2' }))
    const panel = within(await screen.findByRole('dialog', { name: '小王的 Claude 的 Git 操作记录' }))
    const first = within(panel.getByTestId('git-op-op1'))
    expect(first.getByText('老李')).toBeTruthy()
    expect(first.getByText('推送')).toBeTruthy()
    expect(first.getByText('origin/main')).toBeTruthy()
    expect(first.getByText('批准即确认推送基准分支')).toBeTruthy()
    expect(within(panel.getByTestId('git-op-op2')).getByText('修复')).toBeTruthy()

    fireEvent.click(first.getByRole('button', { name: '批准' }))
    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({ path: '/git-operations/op1/decide', body: { approve: true } }),
    )
    fireEvent.click(within(panel.getByTestId('git-op-op2')).getByRole('button', { name: '拒绝' }))
    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({ path: '/git-operations/op2/decide', body: { approve: false } }),
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: /^待审批/ })).toBeNull())
  })

  it('shows others the status read-only', async () => {
    setMe('u3')
    mockApi(routes({ 'GET /groups/g1/git/operations': { operations: [op()] } }))
    render(<GitBar group={group()} />)
    fireEvent.click(await screen.findByRole('button', { name: '待审批 1' }))
    const panel = within(await screen.findByRole('dialog', { name: '小王的 Claude 的 Git 操作记录' }))
    expect(panel.getByText('待审批')).toBeTruthy()
    expect(panel.queryByRole('button', { name: '批准' })).toBeNull()
  })

  it('follows group.gitOperation events and toasts the requester when it ends', async () => {
    setMe('u2')
    mockApi(routes())
    render(<GitBar group={group()} />)
    await screen.findByTestId('git-b1')
    act(() =>
      useWorkspace
        .getState()
        .applyEvent({ t: 'group.gitOperation', groupId: 'g1', operation: op({ id: 'op9' }) }),
    )
    expect(await screen.findByRole('button', { name: '待审批 1' })).toBeTruthy()
    act(() =>
      useWorkspace.getState().applyEvent({
        t: 'group.gitOperation',
        groupId: 'g1',
        operation: op({ id: 'op9', status: 'failed', error: 'rejected: non-fast-forward' }),
      }),
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: /^待审批/ })).toBeNull())
    const item = useToasts.getState().items.at(-1)
    expect(item?.title).toBe('小王的 Claude：推送失败')
    expect(item?.message).toBe('rejected: non-fast-forward')
  })

  it('opens the linked operation from ?git=', async () => {
    mockApi(routes({ 'GET /groups/g1/git/operations': { operations: [op({ status: 'succeeded' })] } }))
    render(
      <MemoryRouter initialEntries={['/g/g1?git=op1']}>
        <GitBar group={group()} />
        <LinkedGitOperation groupId="g1" />
      </MemoryRouter>,
    )
    const panel = within(await screen.findByRole('dialog', { name: '小王的 Claude 的 Git 操作记录' }))
    expect(panel.getByTestId('git-op-op1').dataset.focused).toBe('true')
  })
})
