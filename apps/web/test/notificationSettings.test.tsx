import type { FeishuIdentityView } from '@gonggong/protocol'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationSettings } from '../src/features/notifications/NotificationSettings'
import { mockApi } from './mockApi'

afterEach(() => vi.unstubAllGlobals())

const identity = (notify: boolean): FeishuIdentityView => ({
  identity: { name: '王磊', avatar: null, email: null, boundAt: '2026-10-01T00:00:00Z', notify },
})

const show = () =>
  render(
    <MemoryRouter>
      <NotificationSettings />
    </MemoryRouter>,
  )

describe('设置 · 通知', () => {
  it('turns 飞书通知 on for a linked account', async () => {
    let view = identity(false)
    const calls = mockApi({
      'GET /auth/options': { registrationOpen: false, feishuLogin: true },
      'GET /me/feishu': () => view,
      'PUT /me/feishu/notify': (body: unknown) => {
        view = identity((body as { notify: boolean }).notify)
      },
    })
    show()
    const toggle = (await screen.findByRole('switch', { name: '飞书通知' })) as HTMLInputElement
    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'PUT', path: '/me/feishu/notify', body: { notify: true } }),
    )
    await waitFor(() => expect(toggle.checked).toBe(true))
  })

  it('asks to link Feishu first when the account is not linked', async () => {
    mockApi({
      'GET /auth/options': { registrationOpen: false, feishuLogin: true },
      'GET /me/feishu': { identity: null },
    })
    show()
    expect(((await screen.findByRole('switch', { name: '飞书通知' })) as HTMLInputElement).disabled).toBe(
      true,
    )
    screen.getByText('绑定飞书')
  })
})
