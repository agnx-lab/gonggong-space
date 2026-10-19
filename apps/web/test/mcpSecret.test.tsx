import type { McpSecretCard as Card, InheritedMcpDto, MessageDto, UserDto } from '@gonggong/protocol'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../src/app/session'
import { InheritedMcpList } from '../src/features/config/ConfigPage'
import { McpSecretCard } from '../src/features/config/McpSecretCard'
import { mockApi } from './mockApi'

const me: UserDto = {
  id: 'u1',
  account: 'li',
  name: '李建国',
  role: 'member',
  mustChangePassword: false,
  disabled: false,
  gitProtocol: 'auto',
  email: null,
  avatar: null,
}
const card: Card = { id: 'r1', name: 'wiki', keys: ['TOKEN', 'REGION'], userId: 'u1', filled: false }
const m: MessageDto = {
  id: 'm1',
  seq: 3,
  groupId: 'g1',
  kind: 'event',
  authorId: null,
  authorName: '',
  body: 'Claude 请 李建国 填写 MCP「wiki」的密钥：TOKEN、REGION',
  mentions: [],
  runId: null,
  createdAt: new Date().toISOString(),
  attachments: [],
  quote: null,
  mcpSecret: card,
}

beforeEach(() => useSession.setState({ user: me, status: 'ready' }))
afterEach(() => vi.unstubAllGlobals())

describe('legacy MCP 填写密钥 card', () => {
  it('is read-only now: no fill button, pointing to secrets instead', () => {
    render(<McpSecretCard m={m} card={card} />)
    expect(screen.getByTestId('mcp-secret-card').textContent).toContain(
      '填写 MCP「wiki」的密钥：TOKEN、REGION',
    )
    expect(screen.queryByRole('button', { name: '填写密钥' })).toBeNull()
    expect(screen.getByText('已停用，请改用密钥')).toBeTruthy()
  })

  it('still shows a filled card as filled', () => {
    render(<McpSecretCard m={m} card={{ ...card, filled: true }} />)
    expect(screen.getByText('已填写')).toBeTruthy()
  })
})

describe('群设置 · 继承的 MCP', () => {
  it('lists team and platform servers with their layer and turns one off for this group', async () => {
    const docs: InheritedMcpDto = {
      id: 's1',
      enabled: true,
      updatedAt: new Date().toISOString(),
      config: { transport: 'http', name: 'docs', url: 'https://mcp.corp/docs', headers: {} },
      scope: 'team',
      enabledInGroup: true,
    }
    const calls = mockApi({
      'GET /groups/g1/inherited-mcp': [docs],
      'PUT /groups/g1/inherited-mcp/docs': { ...docs, enabledInGroup: false },
    })
    render(<InheritedMcpList groupId="g1" />)
    const row = (await screen.findByText('docs')).closest('.cfg__item') as HTMLElement
    expect(row.textContent).toContain('团队层')
    expect(row.textContent).toContain('https://mcp.corp/docs')
    fireEvent.click(within(row).getByRole('switch', { name: '在本群启用 docs' }))
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PUT',
        path: '/groups/g1/inherited-mcp/docs',
        body: { enabled: false },
      }),
    )
  })
})
