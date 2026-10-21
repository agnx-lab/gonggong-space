import type { ApprovalDto, BotDto, QuestionSetDto, RunDto } from '@gonggong/protocol'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../src/app/session'
import { useWorkspace } from '../src/app/workspace'
import { PendingDock } from '../src/features/chat/PendingDock'
import { mockApi } from './mockApi'

const NOW = new Date(2026, 8, 23, 10, 21, 0)

const bots = [
  { id: 'b1', name: '小王的 Claude', ownerId: 'u1', ownerName: '王磊', tier: 'workspace', avatar: 'role-no' },
  { id: 'b2', name: '测试 Bot', ownerId: 'u2', ownerName: '陈晨', tier: 'workspace', avatar: 'role-no' },
] as BotDto[]

const approval = (o: Partial<ApprovalDto> = {}): ApprovalDto => ({
  id: 'a1',
  runId: 'r1',
  title: 'Bash',
  toolKind: 'execute',
  detail: 'go build ./...',
  options: [
    { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
    { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
  ],
  remember: [],
  status: 'pending',
  voidReason: null,
  decidedBy: null,
  decidedByName: null,
  decidedAt: null,
  expiresAt: new Date(NOW.getTime() + 90_000).toISOString(),
  createdAt: NOW.toISOString(),
  ...o,
})

const set = (o: Partial<QuestionSetDto> = {}): QuestionSetDto => ({
  id: 'qs1',
  runId: 'r2',
  questions: [
    { id: 'q1', type: 'yesno', title: '允许改 fixture 吗？', options: ['是', '否'], recommended: 0 },
  ],
  status: 'pending',
  answers: null,
  attachments: [],
  answeredBy: null,
  answeredByName: null,
  answeredAt: null,
  expiresAt: new Date(NOW.getTime() + 60_000).toISOString(),
  createdAt: NOW.toISOString(),
  leanings: [],
  ...o,
})

const run = (o: Partial<RunDto>) =>
  ({
    id: 'r1',
    groupId: 'g1',
    botId: 'b1',
    originUserId: 'u1',
    status: 'awaiting_approval',
    step: '',
    queuedAt: NOW.toISOString(),
    approvals: [],
    questions: [],
    ...o,
  }) as RunDto

const login = (id: string) =>
  useSession.setState({
    user: {
      id,
      account: id,
      name: id,
      role: 'member',
      mustChangePassword: false,
      disabled: false,
      gitProtocol: 'auto',
      email: null,
      avatar: null,
    },
    status: 'ready',
  })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
  useWorkspace.setState({ bots })
  login('u1')
})
afterEach(() => vi.useRealTimers())

describe('PendingDock', () => {
  it('renders nothing while nothing waits', () => {
    const decided = run({ status: 'running', approvals: [approval({ status: 'approved' })] })
    const { container } = render(<PendingDock runs={[decided]} onLocate={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('shows a single pending approval right above the composer, decidable in place', async () => {
    const calls = mockApi({ 'POST /runs/r1/approvals/a1': approval({ status: 'approved' }) })
    const onLocate = vi.fn()
    const r = run({ approvals: [approval()] })
    render(<PendingDock runs={[r]} onLocate={onLocate} />)
    const dock = screen.getByTestId('pending-dock')
    expect(dock.textContent).toContain('小王的 Claude')
    expect(dock.textContent).toContain('go build ./...')
    fireEvent.click(screen.getByRole('button', { name: '定位' }))
    expect(onLocate).toHaveBeenCalledWith(r)
    fireEvent.click(screen.getByRole('button', { name: '批准' }))
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/runs/r1/approvals/a1',
        body: { optionId: 'allow' },
      }),
    )
  })

  it('folds several waiting items into 待处理 N 项, oldest first, and expands them', () => {
    const later = new Date(NOW.getTime() + 5_000).toISOString()
    const runs = [
      run({ id: 'r2', botId: 'b2', status: 'awaiting_answer', questions: [set({ createdAt: later })] }),
      run({ approvals: [approval()] }),
    ]
    render(<PendingDock runs={runs} onLocate={() => {}} />)
    const head = screen.getByRole('button', { name: /待处理 2 项/ })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('go build ./...')).toBeNull()
    fireEvent.click(head)
    const items = screen.getAllByTestId('pending-item')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain('go build ./...')
    expect(items[1]?.textContent).toContain('允许改 fixture 吗？')
  })

  it('pins only what I may decide; others wait read-only on their own cards', () => {
    const runs = [
      run({ approvals: [approval()] }),
      run({
        id: 'r2',
        botId: 'b2',
        status: 'awaiting_approval',
        approvals: [approval({ id: 'a2', runId: 'r2' })],
      }),
      run({
        id: 'r3',
        botId: 'b2',
        originUserId: 'u1',
        status: 'awaiting_answer',
        questions: [set({ runId: 'r3' })],
      }),
    ]
    login('u2')
    const { unmount } = render(<PendingDock runs={runs} onLocate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /待处理 2 项/ }))
    expect(screen.getAllByTestId('pending-item').map((i) => i.textContent?.includes('测试 Bot'))).toEqual([
      true,
      true,
    ])
    unmount()
    login('u3')
    const { container } = render(<PendingDock runs={runs} onLocate={() => {}} />)
    expect(container.textContent).toBe('')
  })

  describe('on a phone', () => {
    let listeners: Record<string, () => void>
    let viewport: {
      height: number
      addEventListener: (k: string, f: () => void) => void
      removeEventListener: () => void
    }
    beforeEach(() => {
      listeners = {}
      viewport = {
        height: 800,
        addEventListener: (k, f) => (listeners[k] = f),
        removeEventListener: () => {},
      }
      vi.stubGlobal('visualViewport', viewport)
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('max-width'), media: q }))
    })
    afterEach(() => vi.unstubAllGlobals())

    it('starts folded even for one item, and folds again when the keyboard opens', () => {
      render(<PendingDock runs={[run({ approvals: [approval()] })]} onLocate={() => {}} />)
      const head = screen.getByRole('button', { name: /待处理 1 项/ })
      expect(head.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(head)
      expect(screen.getByText('go build ./...')).toBeTruthy()
      viewport.height = 450
      act(() => listeners.resize?.())
      expect(head.getAttribute('aria-expanded')).toBe('false')
    })
  })
})
