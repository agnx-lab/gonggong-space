import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiffView } from '../src/features/diff/DiffParts'
import type { DiffFile } from '../src/features/diff/patch'
import { useDiffSettings } from '../src/features/diff/store'

const file = (lines: string[], path = 'notes.txt'): DiffFile => ({
  path,
  status: 'modified',
  add: 0,
  del: 0,
  binary: false,
  lines,
})
const nums = (el: Element) =>
  Array.from(el.querySelectorAll('.diff__num'), (n) => n.getAttribute('data-n') ?? '')
/** A side-by-side row as [old number, old code] and [new number, new code]. */
const sides = (row: Element) =>
  Array.from(row.querySelectorAll('.diff__side'), (s) => [
    s.querySelector('.diff__num')?.getAttribute('data-n') ?? '',
    s.querySelector('.diff__code')?.textContent ?? '',
  ])
const marks = (el: Element) => ({
  del: Array.from(el.querySelectorAll('.diff__word--del'), (m) => m.textContent),
  add: Array.from(el.querySelectorAll('.diff__word--add'), (m) => m.textContent),
})

beforeEach(() => useDiffSettings.setState({ view: 'unified', ignoreWhitespace: false, fullContext: false }))
afterEach(() => vi.restoreAllMocks())

describe('unified diff view', () => {
  it('numbers old and new lines in a gutter that stays out of the text', () => {
    const lines = ['@@ -9,3 +9,3 @@', ' a', '-b', '+c', ' d']
    render(<DiffView file={file(lines)} />)
    const rows = [...document.querySelectorAll('.diff__line')]
    expect(rows.map(nums)).toEqual([
      ['', ''],
      ['9', '9'],
      ['10', ''],
      ['', '10'],
      ['11', '11'],
    ])
    expect(rows.map((r) => r.textContent)).toEqual(lines)
  })

  it('groups each change so it can be stepped to', () => {
    render(<DiffView file={file(['@@ -1,4 +1,4 @@', '-a', '+A', ' b', ' c', '-d', '+D'])} />)
    expect(Array.from(document.querySelectorAll('[data-change]'), (b) => b.textContent)).toEqual([
      '-a+A',
      '-d+D',
    ])
  })
})

describe('side-by-side diff view', () => {
  it('shows the old file left and the new one right, pairing deletions with additions', () => {
    render(<DiffView file={file(['@@ -1,4 +1,3 @@', ' a', '-b', '-c', '+B', ' d'])} view="split" />)
    expect(document.querySelector('.diff__line--hunk')?.textContent).toBe('@@ -1,4 +1,3 @@')
    const rows = [...document.querySelectorAll('.diff__pair')]
    expect(rows.map(sides)).toEqual([
      [
        ['1', 'a'],
        ['1', 'a'],
      ],
      [
        ['2', 'b'],
        ['2', 'B'],
      ],
      [
        ['3', 'c'],
        ['', ''],
      ],
      [
        ['4', 'd'],
        ['3', 'd'],
      ],
    ])
    expect(rows[2]?.querySelectorAll('.diff__side--empty')).toHaveLength(1)
    expect(document.querySelectorAll('[data-change]')).toHaveLength(1)
  })

  it('follows the stored view and falls back to unified when narrow', () => {
    useDiffSettings.setState({ view: 'split' })
    const f = file(['@@ -1 +1 @@', '-a', '+b'])
    const { unmount } = render(<DiffView file={f} />)
    expect(document.querySelectorAll('.diff__pair')).toHaveLength(1)
    unmount()

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500)
    render(<DiffView file={f} />)
    expect(document.querySelector('.diff__pair')).toBeNull()
    expect(document.querySelectorAll('.diff__line')).toHaveLength(3)
  })
})

describe('word highlights', () => {
  it('marks the changed words of an edited line in both views, over the syntax colours', async () => {
    const f = file(['@@ -1 +1 @@', '-const total = price * 2', '+const total = cost * 2'], 'a.ts')
    const { container, rerender } = render(<DiffView file={f} />)
    expect(marks(container)).toEqual({ del: ['price'], add: ['cost'] })
    await waitFor(() => expect(container.querySelector('.diff__word--add .hl')?.textContent).toBe('cost'))
    expect(Array.from(container.querySelectorAll('.diff__line'), (l) => l.textContent)).toEqual(f.lines)

    rerender(<DiffView file={f} view="split" />)
    expect(marks(container)).toEqual({ del: ['price'], add: ['cost'] })
    expect(container.querySelector('.diff__word--del .hl')?.textContent).toBe('price')
  })

  it('leaves rewritten lines whole', () => {
    const { container } = render(<DiffView file={file(['@@ -1 +1 @@', '-old', '+new'])} />)
    expect(marks(container)).toEqual({ del: [], add: [] })
  })
})
