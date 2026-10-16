import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkbench } from '../src/app/workbench'
import { Markdown } from '../src/features/chat/Markdown'
import { BotFileViewer } from '../src/features/files/FileViewer'
import { useToasts } from '../src/ui'
import { apiError, mockApi } from './mockApi'

const text = (path: string) => `/groups/g1/bots/b1/files/text?path=${encodeURIComponent(path)}`

beforeEach(() => {
  useWorkbench.setState({ groupId: 'g1', open: false, mode: 'split', previous: 'split', benches: {} })
  useToasts.setState({ items: [] })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const tabs = () => useWorkbench.getState().benches.g1?.tabs ?? []

describe('file references in bot replies', () => {
  it('turns inline code paths into buttons, but not plain code, prose or fenced code', () => {
    mockApi({})
    render(
      <Markdown
        botId="b1"
        text={'见 `apps/web/src/a.tsx:12-20`，`plain`，`https://x.com/a.html`\n\n```\nsrc/b.ts\n```'}
      />,
    )
    expect(screen.getByRole('button', { name: 'apps/web/src/a.tsx:12-20' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'plain' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'https://x.com/a.html' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'src/b.ts' })).toBeNull()
  })

  it("opens the file of this reply's bot at the line range, and reuses the previous file for :line shorthands", async () => {
    const calls = mockApi({ [`GET ${text('apps/web/src/a.tsx')}`]: { path: 'apps/web/src/a.tsx' } })
    render(<Markdown botId="b1" text={'`apps/web/src/a.tsx:12-20` 之后是 `:30`'} />)
    fireEvent.click(screen.getByRole('button', { name: 'apps/web/src/a.tsx:12-20' }))
    await waitFor(() => expect(tabs()).toHaveLength(1))
    expect(tabs()[0]).toEqual({
      kind: 'file',
      source: { botId: 'b1', path: 'apps/web/src/a.tsx', line: { from: 12, to: 20 } },
    })
    expect(calls.map((c) => c.path)).toContain(text('apps/web/src/a.tsx'))

    mockApi({ [`GET ${text('apps/web/src/a.tsx')}`]: { path: 'apps/web/src/a.tsx' } })
    fireEvent.click(screen.getByRole('button', { name: ':30' }))
    await waitFor(() =>
      expect(tabs()[0]).toEqual({
        kind: 'file',
        source: { botId: 'b1', path: 'apps/web/src/a.tsx', line: { from: 30, to: 30 } },
      }),
    )
  })

  it('says the file is not in the workspace when it cannot be read', async () => {
    mockApi({ [`GET ${text('nope/x.ts')}`]: () => apiError(409, 'conflict', '文件不存在') })
    render(<Markdown botId="b1" text={'`nope/x.ts`'} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'nope/x.ts' })))
    await waitFor(() => expect(useToasts.getState().items[0]?.message).toBe('工作区里没找到'))
    expect(tabs()).toHaveLength(0)
  })
})

describe('bare file names and the file tab line range', () => {
  const find = (name: string) => `GET /groups/g1/bots/b1/files/find?name=${name}`

  it('opens the only workspace file of that name at the line', async () => {
    mockApi({ [find('Markdown.tsx')]: { paths: ['apps/web/src/features/chat/Markdown.tsx'] } })
    render(<Markdown botId="b1" text={'`Markdown.tsx:12`'} />)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown.tsx:12' }))
    await waitFor(() => expect(tabs()).toHaveLength(1))
    expect(tabs()[0]).toEqual({
      kind: 'file',
      source: { botId: 'b1', path: 'apps/web/src/features/chat/Markdown.tsx', line: { from: 12, to: 12 } },
    })
  })

  it('lets the user pick among several files of that name', async () => {
    mockApi({ [find('Button.tsx')]: { paths: ['src/ui/Button.tsx', 'lib/ui/Button.tsx'] } })
    render(<Markdown botId="b1" text={'`Button.tsx`'} />)
    fireEvent.click(screen.getByRole('button', { name: 'Button.tsx' }))
    fireEvent.click(await screen.findByRole('button', { name: 'lib/ui/Button.tsx' }))
    await waitFor(() => expect(tabs()).toHaveLength(1))
    expect(tabs()[0]).toEqual({ kind: 'file', source: { botId: 'b1', path: 'lib/ui/Button.tsx' } })
  })

  it('says so when no workspace file has that name', async () => {
    mockApi({ [find('Ghost.tsx')]: { paths: [] } })
    render(<Markdown botId="b1" text={'`Ghost.tsx`'} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ghost.tsx' }))
    await waitFor(() => expect(useToasts.getState().items[0]?.message).toBe('工作区里没找到'))
    expect(tabs()).toHaveLength(0)
  })

  it('highlights the line range of a file tab and scrolls to it', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    mockApi({
      [`GET ${text('src/main.ts')}`]: {
        path: 'src/main.ts',
        size: 8,
        binary: false,
        mime: 'text/plain',
        text: 'a\nb\nc\nd\n',
      },
    })
    const { container } = render(<BotFileViewer botId="b1" path="src/main.ts" line={{ from: 2, to: 3 }} />)
    await waitFor(() => expect(container.querySelectorAll('.pv-line--hit')).toHaveLength(2))
    expect(container.querySelector('.pv-line--hit')?.textContent).toContain('b')
    await waitFor(() => expect(scroll).toHaveBeenCalled())
  })
})
