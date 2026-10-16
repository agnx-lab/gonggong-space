import type { MessageDto, RunDto } from '@gonggong/protocol'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { type ActionTarget, branchableRuns, MessageActions } from '../src/features/chat/MessageActions'
import { mockApi } from './mockApi'

const reply = {
  id: 'm1',
  seq: 3,
  groupId: 'g1',
  kind: 'bot',
  authorId: 'b1',
  authorName: '小王的 Claude',
  body: '第一答',
  mentions: [],
  runId: 'r1',
  createdAt: new Date().toISOString(),
  attachments: [],
  quote: null,
} as unknown as MessageDto

const target = (o: Partial<ActionTarget> = {}): ActionTarget => ({
  message: reply,
  link: '',
  onQuote: () => {},
  copyText: reply.body,
  ...o,
})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function open(t: ActionTarget) {
  render(
    <MemoryRouter initialEntries={['/g/g1']}>
      <MessageActions {...t} />
      <Where />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: '更多' }))
}

describe('分支到新聊天', () => {
  it('branches a completed bot reply and opens the new chat', async () => {
    const calls = mockApi({ 'POST /messages/m1/branch': { groupId: 'g2' } })
    open(target({ branchable: true }))
    fireEvent.click(await screen.findByText('分支到新聊天'))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/g/g2'))
    expect(calls).toEqual([expect.objectContaining({ method: 'POST', path: '/messages/m1/branch' })])
  })

  it('is not offered when the reply is not branchable', async () => {
    open(target({ branchable: false }))
    await screen.findByText('复制链接')
    expect(screen.queryByText('分支到新聊天')).toBeNull()
  })

  it('is offered only on each owned bot latest completed run', () => {
    const run = (id: string, botId: string, status: string, startedAt: string | null) =>
      ({ id, botId, status, startedAt }) as unknown as RunDto
    const runs = [
      run('r1', 'mine', 'completed', '2026-10-16T10:00:00Z'),
      run('r2', 'mine', 'completed', '2026-10-16T11:00:00Z'),
      run('r3', 'mine', 'interrupted', '2026-10-16T12:00:00Z'),
      run('r4', 'theirs', 'completed', '2026-10-16T13:00:00Z'),
      run('r5', 'theirs', 'completed', '2026-10-16T14:00:00Z'),
    ]
    expect([...branchableRuns(runs, (botId) => botId === 'mine')]).toEqual(['r2'])
  })
})
