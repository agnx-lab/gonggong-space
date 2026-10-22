import type {
  BotDto,
  GitCompareDto,
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
import { apiError, type Call, mockApi } from './mockApi'

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

type Git = NonNullable<GroupBotStateDto['git']>
const status = (o: Partial<Git> = {}): Git => ({
  branch: 'feat/refund-v2',
  ahead: 3,
  behind: 0,
  dirty: true,
  dirtyCount: 3,
  workspace: 'managed',
  repos: [],
  ...o,
})

const state = (o: Partial<GroupBotStateDto> = {}): GroupBotStateDto => ({
  botId: 'b1',
  workspace: 'managed',
  path: '/w/b1',
  state: 'ready',
  git: status(),
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
    branch('main', { upstream: 'origin/main', ahead: 0, behind: 2, subject: '发布 v0.3.6' }),
    branch('feat/refund-v2', { current: true, upstream: 'origin/feat/refund-v2', ahead: 3, behind: 0 }),
    branch('origin/main', { kind: 'remote' }),
    branch('origin/feat/pay', { kind: 'remote' }),
  ],
  remotes: [{ name: 'origin', url: 'git@git.corp:pay/refund.git' }],
}

const CHANGES: GitCompareDto = {
  changes: [
    { path: 'src/a.ts', change: 'modified', oldPath: null },
    { path: 'src/new.ts', change: 'added', oldPath: null },
    { path: 'b.ts', change: 'renamed', oldPath: 'old.ts' },
  ],
}

const op = (o: Partial<GitOperationDto> = {}): GitOperationDto => ({
  id: 'op1',
  groupId: 'g1',
  botId: 'b1',
  repo: null,
  action: 'push',
  branch: 'main',
  remote: 'origin',
  message: null,
  paths: null,
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
  [`GET ${BASE}/compare?from=HEAD`]: CHANGES,
  [`POST ${BASE}/refresh`]: undefined,
  ...extra,
})
const toasts = () => useToasts.getState().items.map((t) => t.message)
const actionsCalled = (calls: Call[]) => calls.filter((c) => c.path === `${BASE}/actions`).map((c) => c.body)
const refreshes = (calls: Call[]) => calls.filter((c) => c.path === `${BASE}/refresh`).map((c) => c.body)
const actions = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '小王的 Claude 的工作区' }))
  return within(await screen.findByRole('dialog', { name: '小王的 Claude 的工作区' }))
}
const branches = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '切换 小王的 Claude 的分支' }))
  return within(await screen.findByRole('dialog', { name: '小王的 Claude 的分支' }))
}
const checkoutOp = op({
  action: 'checkout',
  status: 'succeeded',
  pushesBase: false,
  requestedBy: { id: 'u1', name: '小王' },
})

describe('branch switcher', () => {
  it('groups local and remote branches with their last commit, searches, and switches a clean tree directly', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T00:00:00.000Z'))
    const calls = mockApi(
      routes({
        'GET /groups/g1/bot-states': [state({ git: status({ dirty: false, dirtyCount: 0 }) })],
        [`POST ${BASE}/actions`]: checkoutOp,
      }),
    )
    render(<GitBar group={group()} />)
    const trigger = await screen.findByRole('button', { name: '切换 小王的 Claude 的分支' })
    expect(trigger.textContent).toBe('feat/refund-v2')
    const pop = await branches()
    await waitFor(() => expect(refreshes(calls)).toEqual([{ fetch: false }]))
    const local = within(await pop.findByRole('group', { name: '本地' }))
    const remote = within(pop.getByRole('group', { name: '远程' }))
    expect(local.getAllByRole('button').map((b) => b.dataset.ref)).toEqual(['main', 'feat/refund-v2'])
    expect(remote.getAllByRole('button').map((b) => b.dataset.ref)).toEqual([
      'origin/main',
      'origin/feat/pay',
    ])
    const main = local.getByRole('button', { name: /^main/ })
    expect(within(main).getByRole('img', { name: '落后 2 个提交' })).toBeTruthy()
    expect(within(main).getByText('发布 v0.3.6 · 1 天前')).toBeTruthy()
    const current = local.getByRole('button', { name: /^feat\/refund-v2/ })
    expect(current.getAttribute('aria-current')).toBe('true')
    expect(within(current).getByRole('img', { name: '领先 3 个提交' })).toBeTruthy()
    // The repo URL lives in 执行位置, not here.
    expect(pop.queryByText('git@git.corp:pay/refund.git')).toBeNull()
    vi.useRealTimers()

    fireEvent.change(pop.getByRole('searchbox', { name: '搜索分支' }), { target: { value: 'pay' } })
    expect(pop.queryByRole('group', { name: '本地' })).toBeNull()
    fireEvent.click(pop.getByRole('button', { name: /origin\/feat\/pay/ }))

    expect(screen.queryByRole('dialog', { name: '切换分支' })).toBeNull()
    await waitFor(() =>
      expect(actionsCalled(calls)).toEqual([{ action: 'checkout', branch: 'origin/feat/pay' }]),
    )
    await waitFor(() => expect(toasts()).toContain('小王的 Claude：切换分支完成'))
  })

  it('shows the switch in progress on the branch button', async () => {
    let finish: (r: Response) => void = () => {}
    mockApi(
      routes({
        'GET /groups/g1/bot-states': [state({ git: status({ dirty: false }) })],
        [`POST ${BASE}/actions`]: () => new Promise<Response>((r) => (finish = r)),
      }),
    )
    render(<GitBar group={group()} />)
    const pop = await branches()
    fireEvent.click(await pop.findByRole('button', { name: /origin\/feat\/pay/ }))
    const trigger = await screen.findByRole('button', { name: '切换 小王的 Claude 的分支' })
    await waitFor(() => expect(trigger.textContent).toContain('切换中…'))
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
    finish(new Response(JSON.stringify(checkoutOp)))
    await waitFor(() => expect(trigger.textContent).toBe('feat/refund-v2'))
  })

  it('confirms first when the work tree has uncommitted changes', async () => {
    const calls = mockApi(routes({ [`POST ${BASE}/actions`]: checkoutOp }))
    render(<GitBar group={group()} />)
    fireEvent.click(await (await branches()).findByRole('button', { name: /origin\/feat\/pay/ }))
    const confirm = within(await screen.findByRole('dialog', { name: '切换分支' }))
    expect(confirm.getByText(/feat\/pay/)).toBeTruthy()
    expect(confirm.getByText('未提交的改动会带到新分支；与目标分支冲突时 git 会拒绝切换')).toBeTruthy()
    fireEvent.click(confirm.getByRole('button', { name: '切换' }))
    await waitFor(() =>
      expect(actionsCalled(calls)).toEqual([{ action: 'checkout', branch: 'origin/feat/pay' }]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '切换分支' })).toBeNull())
  })

  it("tells a non-owner the switch is a request for the owner's approval", async () => {
    setMe('u2')
    const calls = mockApi(
      routes({
        'GET /groups/g1/bot-states': [state({ git: status({ dirty: false }) })],
        [`POST ${BASE}/actions`]: op({ action: 'checkout', status: 'pending_approval' }),
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click(await (await branches()).findByRole('button', { name: /origin\/feat\/pay/ }))
    const confirm = within(await screen.findByRole('dialog', { name: '申请切换分支' }))
    expect(confirm.getByText('需要 Bot 主人 小王 批准后才会切换')).toBeTruthy()
    fireEvent.click(confirm.getByRole('button', { name: '提交申请' }))
    await waitFor(() =>
      expect(actionsCalled(calls)).toEqual([{ action: 'checkout', branch: 'origin/feat/pay' }]),
    )
    await waitFor(() => expect(toasts()).toContain('已提交申请，等待 Bot 主人 小王 审批'))
  })
})

describe('git menu', () => {
  it('refreshes the status on open and shows how far the branch is from its upstream', async () => {
    const calls = mockApi(
      routes({ 'GET /groups/g1/bot-states': [state({ git: status({ behind: 2, ahead: 3 }) })] }),
    )
    render(<GitBar group={group()} />)
    const menu = await actions()
    await waitFor(() => expect(refreshes(calls)).toEqual([{ fetch: false }]))
    expect(menu.getByRole('button', { name: /^拉取/ }).textContent).toBe('拉取↓2')
    expect(menu.getByRole('button', { name: /^推送…/ }).textContent).toBe('推送…↑3')
    expect((menu.getByRole('button', { name: '提交…' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('greys out commit on a clean tree; push says nothing is new but stays available', async () => {
    mockApi(
      routes({
        'GET /groups/g1/bot-states': [state({ git: status({ dirty: false, dirtyCount: 0, ahead: 0 }) })],
      }),
    )
    render(<GitBar group={group()} />)
    const menu = await actions()
    expect((menu.getByRole('button', { name: '提交…' }) as HTMLButtonElement).disabled).toBe(true)
    const push = menu.getByRole('button', { name: /^推送…/ }) as HTMLButtonElement
    expect(push.textContent).toBe('推送…无新提交')
    expect(push.disabled).toBe(false)
    expect(menu.getByRole('button', { name: /^拉取/ }).textContent).toBe('拉取')
  })

  it('offers publishing a branch without an upstream', async () => {
    mockApi(
      routes({
        'GET /groups/g1/bot-states': [state({ git: status({ ahead: null, behind: null }) })],
      }),
    )
    render(<GitBar group={group()} />)
    expect((await actions()).getByRole('button', { name: /^推送…/ }).textContent).toBe('推送…未发布')
  })

  it("words a non-owner's actions as requests", async () => {
    setMe('u2')
    mockApi(routes())
    render(<GitBar group={group()} />)
    const menu = await actions()
    expect(menu.getByRole('button', { name: /^申请拉取/ })).toBeTruthy()
    expect(menu.getByRole('button', { name: '申请提交…' })).toBeTruthy()
    expect(menu.getByRole('button', { name: /^申请推送…/ })).toBeTruthy()
    fireEvent.click(menu.getByRole('button', { name: '申请提交…' }))
    const dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(dialog.getByRole('button', { name: '提交申请' })).toBeTruthy()
  })

  it('fetches the remotes on demand, showing progress and the failure reason', async () => {
    let finish: (r: Response) => void = () => {}
    const calls = mockApi(
      routes({
        [`POST ${BASE}/refresh`]: (b: { fetch: boolean }) =>
          b.fetch ? new Promise<Response>((r) => (finish = r)) : undefined,
      }),
    )
    render(<GitBar group={group()} />)
    const menu = await actions()
    await waitFor(() => expect(refreshes(calls)).toHaveLength(1))
    fireEvent.click(menu.getByRole('button', { name: '获取远程更新' }))
    expect(refreshes(calls).at(-1)).toEqual({ fetch: true })
    const busy = await menu.findByRole('button', { name: '正在获取远程更新…' })
    expect((busy as HTMLButtonElement).disabled).toBe(true)
    finish(apiError(502, 'git_failed', 'fatal: could not read from remote repository'))
    await waitFor(() => expect(toasts()).toContain('fatal: could not read from remote repository'))
    expect(menu.getByRole('button', { name: '获取远程更新' })).toBeTruthy()
  })
})

describe('git actions', () => {
  it('pulls', async () => {
    const calls = mockApi(
      routes({
        [`POST ${BASE}/actions`]: (b: { action: string }) =>
          op({ action: b.action as 'pull', status: 'succeeded' }),
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: /^拉取/ }))
    await waitFor(() => expect(actionsCalled(calls)).toEqual([{ action: 'pull' }]))
  })

  it('lists the files to commit, all picked, and commits the picked ones with the message', async () => {
    const calls = mockApi(routes({ [`POST ${BASE}/actions`]: op({ action: 'commit', status: 'succeeded' }) }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    const dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(await dialog.findByText('已选 3 / 3 个文件')).toBeTruthy()
    const files = within(dialog.getByRole('list', { name: '要提交的文件' }))
    expect(files.getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)).toEqual([
      true,
      true,
      true,
    ])
    expect(
      within(files.getByRole('button', { name: '查看 b.ts 的改动' })).getByTitle('重命名').textContent,
    ).toBe('R')
    expect(files.getByText('old.ts → b.ts')).toBeTruthy()

    fireEvent.click(files.getByRole('checkbox', { name: 'src/new.ts' }))
    expect(dialog.getByText('已选 2 / 3 个文件')).toBeTruthy()
    const submit = dialog.getByRole('button', { name: '提交' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(dialog.getByRole('textbox', { name: '提交说明' }), { target: { value: '修复退款' } })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(actionsCalled(calls)).toEqual([
        { action: 'commit', message: '修复退款', paths: ['src/a.ts', 'old.ts', 'b.ts'] },
      ]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '提交改动' })).toBeNull())
  })

  it('selects all or none, refuses an empty pick, and commits with ⌘/Ctrl+Enter', async () => {
    const calls = mockApi(routes({ [`POST ${BASE}/actions`]: op({ action: 'commit', status: 'succeeded' }) }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    const dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    await dialog.findByText('已选 3 / 3 个文件')
    const message = dialog.getByRole('textbox', { name: '提交说明' })
    fireEvent.change(message, { target: { value: '修复退款' } })
    fireEvent.click(dialog.getByRole('button', { name: '取消全选' }))
    expect(dialog.getByText('已选 0 / 3 个文件')).toBeTruthy()
    expect((dialog.getByRole('button', { name: '提交' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(message, { key: 'Enter', metaKey: true })
    expect(actionsCalled(calls)).toEqual([])
    fireEvent.click(dialog.getByRole('button', { name: '全选' }))
    expect(dialog.getByText('已选 3 / 3 个文件')).toBeTruthy()
    fireEvent.keyDown(message, { key: 'Enter', ctrlKey: true })
    await waitFor(() =>
      expect(actionsCalled(calls)).toEqual([
        { action: 'commit', message: '修复退款', paths: ['src/a.ts', 'src/new.ts', 'old.ts', 'b.ts'] },
      ]),
    )
  })

  it("opens a file's uncommitted diff and keeps the draft for when the dialog reopens", async () => {
    mockApi(routes())
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    let dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    await dialog.findByText('已选 3 / 3 个文件')
    fireEvent.change(dialog.getByRole('textbox', { name: '提交说明' }), { target: { value: '修复退款' } })
    fireEvent.click(dialog.getByRole('checkbox', { name: 'src/new.ts' }))
    fireEvent.click(dialog.getByRole('button', { name: '查看 src/a.ts 的改动' }))
    expect(useWorkbench.getState().benches.g1?.tabs).toEqual([
      { kind: 'diff', botId: 'b1', scope: 'uncommitted', file: 'src/a.ts', repo: null },
    ])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '提交改动' })).toBeNull())

    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(await dialog.findByText('已选 2 / 3 个文件')).toBeTruthy()
    expect((dialog.getByRole('textbox', { name: '提交说明' }) as HTMLTextAreaElement).value).toBe('修复退款')
    // Cancelling drops the draft.
    fireEvent.click(dialog.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '提交改动' })).toBeNull())
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(await dialog.findByText('已选 3 / 3 个文件')).toBeTruthy()
    expect((dialog.getByRole('textbox', { name: '提交说明' }) as HTMLTextAreaElement).value).toBe('')
  })

  it('says when there is nothing to commit or the changes cannot be read', async () => {
    mockApi(routes({ [`GET ${BASE}/compare?from=HEAD`]: { changes: [] } }))
    const { unmount } = render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    let dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(await dialog.findByText('没有未提交的改动')).toBeTruthy()
    expect((dialog.getByRole('button', { name: '提交' }) as HTMLButtonElement).disabled).toBe(true)
    unmount()

    mockApi(routes({ [`GET ${BASE}/compare?from=HEAD`]: apiError(502, 'git_failed', '工作区不可用') }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: '提交…' }))
    dialog = within(await screen.findByRole('dialog', { name: '提交改动' }))
    expect(await dialog.findByText('读取改动失败：工作区不可用')).toBeTruthy()
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
    await dialog.findByText('已选 3 / 3 个文件')
    fireEvent.change(dialog.getByRole('textbox', { name: '提交说明' }), { target: { value: '修复退款' } })
    fireEvent.click(dialog.getByRole('button', { name: '提交' }))
    await waitFor(() => expect(toasts()).toContain('没有可提交的改动'))
    expect(screen.getByRole('dialog', { name: '提交改动' })).toBeTruthy()
  })

  it('pushes to the current branch saying what goes where, and asks for a second confirmation for the protected base', async () => {
    const calls = mockApi(routes({ [`POST ${BASE}/actions`]: op({ status: 'succeeded' }) }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: /^推送…/ }))
    let dialog = within(await screen.findByRole('dialog', { name: '推送' }))
    expect((dialog.getByRole('textbox', { name: '分支' }) as HTMLInputElement).value).toBe('feat/refund-v2')
    expect(await dialog.findByRole('button', { name: '远程' })).toBeTruthy()
    expect(dialog.getByText('将 3 个提交推送到 origin/feat/refund-v2')).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: '推送' }))
    await waitFor(() =>
      expect(actionsCalled(calls)).toEqual([
        { action: 'push', remote: 'origin', branch: 'feat/refund-v2', confirmBase: false },
      ]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '推送' })).toBeNull())

    fireEvent.click((await actions()).getByRole('button', { name: /^推送…/ }))
    dialog = within(await screen.findByRole('dialog', { name: '推送' }))
    fireEvent.change(dialog.getByRole('textbox', { name: '分支' }), { target: { value: 'main' } })
    expect(dialog.getByText(/main 是受保护的基准分支/)).toBeTruthy()
    const push = dialog.getByRole('button', { name: '推送' }) as HTMLButtonElement
    expect(push.disabled).toBe(true)
    fireEvent.click(dialog.getByRole('checkbox', { name: '我确认推送到基准分支' }))
    fireEvent.click(push)
    await waitFor(() =>
      expect(actionsCalled(calls).at(-1)).toEqual({
        action: 'push',
        remote: 'origin',
        branch: 'main',
        confirmBase: true,
      }),
    )
  })

  it('explains the first push of a branch without an upstream', async () => {
    mockApi(
      routes({
        'GET /groups/g1/bot-states': [
          state({ git: status({ branch: 'feat/x', ahead: null, behind: null }) }),
        ],
        [`GET ${BASE}/refs`]: {
          ...REFS,
          branches: [branch('main', { upstream: 'origin/main' }), branch('feat/x', { current: true })],
        },
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: /^推送…/ }))
    const dialog = within(await screen.findByRole('dialog', { name: '推送' }))
    expect(await dialog.findByText('首次推送，会在远程创建 feat/x 并设为上游')).toBeTruthy()
  })

  it('tells to pull first when the remote rejects the push', async () => {
    mockApi(
      routes({
        [`POST ${BASE}/actions`]: op({
          status: 'failed',
          requestedBy: { id: 'u1', name: '小王' },
          error: ' ! [rejected]        feat/refund-v2 -> feat/refund-v2 (fetch first)',
        }),
      }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: /^推送…/ }))
    const dialog = within(await screen.findByRole('dialog', { name: '推送' }))
    fireEvent.click(dialog.getByRole('button', { name: '推送' }))
    expect(await dialog.findByText('远程有新的提交，请先拉取再推送')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: '推送' })).toBeTruthy()
  })

  it("tells a non-owner the request waits for the owner's approval", async () => {
    setMe('u2')
    mockApi(routes({ [`POST ${BASE}/actions`]: op({ action: 'pull', status: 'pending_approval' }) }))
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: /^申请拉取/ }))
    await waitFor(() => expect(toasts()).toContain('已提交申请，等待 Bot 主人 小王 审批'))
  })

  it('shows the server message when the bot is busy', async () => {
    mockApi(
      routes({ [`POST ${BASE}/actions`]: apiError(409, 'conflict', '小王的 Claude 正在运行，请稍后再试') }),
    )
    render(<GitBar group={group()} />)
    fireEvent.click((await actions()).getByRole('button', { name: /^拉取/ }))
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
    fireEvent.click(await screen.findByRole('button', { name: '小王的 Claude 的工作区' }))
    const menu = within(await screen.findByRole('dialog', { name: '小王的 Claude 的工作区' }))
    expect(menu.queryByRole('button', { name: /拉取/ })).toBeNull()
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
              paths: ['src/a.ts', 'src/b.ts'],
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
    const second = within(panel.getByTestId('git-op-op2'))
    expect(second.getByText('修复')).toBeTruthy()
    expect(second.getByText('2 个文件')).toBeTruthy()

    fireEvent.click(first.getByRole('button', { name: '批准' }))
    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({ path: '/git-operations/op1/decide', body: { approve: true } }),
    )
    fireEvent.click(second.getByRole('button', { name: '拒绝' }))
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
