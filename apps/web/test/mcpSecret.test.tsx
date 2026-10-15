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

describe('填写密钥 card', () => {
  it('lets the person asked fill every key in password fields, posted straight to the server', async () => {
    const calls = mockApi({ 'POST /mcp-secrets/r1': { ...card, filled: true } })
    render(<McpSecretCard m={m} card={card} />)
    expect(screen.getByTestId('mcp-secret-card').textContent).toContain(
      '填写 MCP「wiki」的密钥：TOKEN、REGION',
    )
    fireEvent.click(screen.getByRole('button', { name: '填写密钥' }))
    const dialog = await screen.findByRole('dialog', { name: '填写 MCP「wiki」的密钥' })
    const save = within(dialog).getByRole('button', { name: '保存' })
    const token = within(dialog).getByLabelText('TOKEN') as HTMLInputElement
    expect(token.type).toBe('password')
    fireEvent.change(token, { target: { value: 'sk-1' } })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('REGION'), { target: { value: 'cn' } })
    fireEvent.click(save)
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/mcp-secrets/r1',
        body: { values: { TOKEN: 'sk-1', REGION: 'cn' } },
      }),
    )
    expect(await screen.findByText('已填写')).toBeTruthy()
  })

  it('only shows the state to everyone else', () => {
    render(<McpSecretCard m={m} card={{ ...card, userId: 'u2' }} />)
    expect(screen.queryByRole('button', { name: '填写密钥' })).toBeNull()
    expect(screen.getByText('等待填写')).toBeTruthy()
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
