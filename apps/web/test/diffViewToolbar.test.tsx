import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changeTarget } from '../src/features/diff/DiffToolbar'
import { GitFileDiff } from '../src/features/diff/GitFileDiff'
import { useDiffSettings } from '../src/features/diff/store'
import { mockApi } from './mockApi'

const URL = '/groups/g1/bots/b1/git/diff?from=main&path=a.txt'
const reply = (...lines: string[]) => ({
  patch: lines.length ? ['diff --git a/a.txt b/a.txt', ...lines, ''].join('\n') : '',
  truncated: false,
})
const lines = () => Array.from(document.querySelectorAll('.diff__line'), (l) => l.textContent)

beforeEach(() => {
  localStorage.clear()
  useDiffSettings.setState({ view: 'unified', ignoreWhitespace: false, fullContext: false })
})
afterEach(() => vi.unstubAllGlobals())

describe('diff toolbar', () => {
  it('switches to side by side and back, remembering the choice', async () => {
    mockApi({ [`GET ${URL}`]: reply('@@ -1 +1 @@', '-a', '+b') })
    render(<GitFileDiff url={URL} path="a.txt" />)
    await waitFor(() => expect(lines()).toEqual(['@@ -1 +1 @@', '-a', '+b']))
    expect(screen.getByRole('radio', { name: '统一' }).getAttribute('aria-checked')).toBe('true')

    fireEvent.click(screen.getByRole('radio', { name: '并排' }))
    expect(localStorage.getItem('gonggong.diffView')).toBe('split')
    expect(document.querySelectorAll('.diff__pair')).toHaveLength(1)

    fireEvent.click(screen.getByRole('radio', { name: '统一' }))
    expect(localStorage.getItem('gonggong.diffView')).toBe('unified')
    expect(document.querySelector('.diff__pair')).toBeNull()
  })

  it('reads the diff again without whitespace changes or with the whole file, remembering each', async () => {
    const calls = mockApi({
      [`GET ${URL}`]: reply('@@ -2,2 +2,2 @@', '-a  b', '+a b', ' c'),
      [`GET ${URL}&ignoreWhitespace=1`]: reply(),
      [`GET ${URL}&ignoreWhitespace=1&context=100000`]: reply('@@ -1,3 +1,3 @@', ' top', ' a b', ' c'),
    })
    render(<GitFileDiff url={URL} path="a.txt" />)
    await waitFor(() => expect(lines()).toEqual(['@@ -2,2 +2,2 @@', '-a  b', '+a b', ' c']))

    fireEvent.click(screen.getByRole('checkbox', { name: '忽略空白' }))
    expect(localStorage.getItem('gonggong.diffIgnoreWhitespace')).toBe('1')
    expect(await screen.findByText('忽略空白后没有差异')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: '显示完整文件' }))
    expect(localStorage.getItem('gonggong.diffFullContext')).toBe('1')
    await waitFor(() => expect(lines()).toEqual(['@@ -1,3 +1,3 @@', ' top', ' a b', ' c']))
    expect(calls.map((c) => c.path)).toEqual([
      URL,
      `${URL}&ignoreWhitespace=1`,
      `${URL}&ignoreWhitespace=1&context=100000`,
    ])
  })

  it('loads the saved settings', async () => {
    localStorage.setItem('gonggong.diffView', 'split')
    localStorage.setItem('gonggong.diffIgnoreWhitespace', '1')
    localStorage.setItem('gonggong.diffFullContext', '1')
    vi.resetModules()
    const { useDiffSettings: fresh } = await import('../src/features/diff/store')
    expect(fresh.getState()).toMatchObject({ view: 'split', ignoreWhitespace: true, fullContext: true })
  })

  it('steps through the changes, flashing the one it moves to', async () => {
    mockApi({ [`GET ${URL}`]: reply('@@ -1,4 +1,4 @@', '-a', '+A', ' b', ' c', '-d', '+D') })
    render(<GitFileDiff url={URL} path="a.txt" />)
    await waitFor(() => expect(document.querySelectorAll('[data-change]')).toHaveLength(2))
    const flashed = () =>
      Array.from(document.querySelectorAll('[data-change]'), (b) => b.hasAttribute('data-flash'))
    const next = screen.getByRole('button', { name: '下一处改动' })
    const prev = screen.getByRole('button', { name: '上一处改动' })

    fireEvent.click(next)
    expect(flashed()).toEqual([true, false])
    fireEvent.click(next)
    expect(flashed()).toEqual([false, true])
    fireEvent.click(next)
    expect(flashed()).toEqual([false, true])
    fireEvent.click(prev)
    expect(flashed()).toEqual([true, false])
  })

  it('holds the caller’s actions, and can be left out', async () => {
    mockApi({ [`GET ${URL}`]: reply('@@ -1 +1 @@', '-a', '+b') })
    const { unmount } = render(
      <GitFileDiff url={URL} path="a.txt" actions={<button type="button">回滚</button>} />,
    )
    expect(screen.getByRole('button', { name: '回滚' })).toBeTruthy()
    await waitFor(() => expect(lines()).toHaveLength(3))
    unmount()

    render(<GitFileDiff url={URL} path="a.txt" toolbar={false} />)
    await waitFor(() => expect(lines()).toHaveLength(3))
    expect(screen.queryByRole('radio', { name: '并排' })).toBeNull()
    expect(screen.queryByRole('button', { name: '下一处改动' })).toBeNull()
  })
})

describe('changeTarget', () => {
  const view = { top: 100, bottom: 500 }
  const blocks = [
    { top: 40, bottom: 80 },
    { top: 120, bottom: 160 },
    { top: 300, bottom: 340 },
    { top: 700, bottom: 760 },
  ]

  it('steps from the current change while it is on screen', () => {
    expect(changeTarget(blocks, view, 1, 1)).toBe(2)
    expect(changeTarget(blocks, view, 2, -1)).toBe(1)
  })

  it('otherwise starts from the top of the view', () => {
    expect(changeTarget(blocks, view, -1, 1)).toBe(1)
    expect(changeTarget(blocks, view, 3, 1)).toBe(1)
    expect(changeTarget(blocks, view, -1, -1)).toBe(0)
  })

  it('stops at either end', () => {
    expect(changeTarget(blocks.slice(0, 3), view, 2, 1)).toBe(-1)
    expect(changeTarget(blocks, { top: 0, bottom: 400 }, -1, -1)).toBe(-1)
  })
})
