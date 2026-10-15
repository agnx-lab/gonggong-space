import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenWith } from '../src/features/workbench/tabs/OpenWith'
import { Toaster } from '../src/ui'
import { apiError, mockApi } from './mockApi'

const base = '/groups/g1/bots/b1'

beforeEach(() => localStorage.removeItem('gg.openWith'))
afterEach(() => vi.unstubAllGlobals())

describe('用本地应用打开', () => {
  it('opens with Finder by default, and remembers the app picked from the menu', async () => {
    const calls = mockApi({
      [`GET ${base}/open-apps`]: { apps: ['finder', 'cursor', 'idea', 'terminal'] },
      [`POST ${base}/open`]: undefined,
    })
    const { unmount } = render(<OpenWith groupId="g1" botId="b1" />)
    fireEvent.click(await screen.findByRole('button', { name: '用 访达 打开' }))
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: `${base}/open`, body: { app: 'finder' } }),
    )

    fireEvent.click(screen.getByRole('button', { name: '选择打开方式' }))
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent)
    expect(items).toEqual(['访达（默认）', 'Cursor', 'IntelliJ IDEA', '终端'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cursor' }))
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: `${base}/open`, body: { app: 'cursor' } }),
    )
    expect(localStorage.getItem('gg.openWith')).toBe('cursor')
    unmount()

    render(<OpenWith groupId="g1" botId="b1" />)
    expect(await screen.findByRole('button', { name: '用 Cursor 打开' })).toBeTruthy()
  })

  it('is hidden when the machine is offline or not mine', async () => {
    mockApi({ [`GET ${base}/open-apps`]: apiError(403, 'forbidden') })
    const { container } = render(<OpenWith groupId="g1" botId="b1" />)
    await waitFor(() => expect(container.textContent).toBe(''))
    expect(container.querySelector('.open-with')).toBeNull()
  })

  it('says why opening failed', async () => {
    mockApi({
      [`GET ${base}/open-apps`]: { apps: ['finder'] },
      [`POST ${base}/open`]: apiError(409, 'conflict', '工作区目录不存在：/x'),
    })
    render(
      <>
        <OpenWith groupId="g1" botId="b1" />
        <Toaster />
      </>,
    )
    fireEvent.click(await screen.findByRole('button', { name: '用 访达 打开' }))
    expect(await screen.findByText('工作区目录不存在：/x')).toBeTruthy()
  })
})
