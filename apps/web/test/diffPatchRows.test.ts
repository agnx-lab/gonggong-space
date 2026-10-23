import { describe, expect, it } from 'vitest'
import { diffRows } from '../src/features/diff/patch'
import { diffBlocks } from '../src/features/diff/split'

describe('diffRows', () => {
  it('numbers each line in the old and the new file, restarting at every hunk', () => {
    const lines = ['@@ -3,3 +3,4 @@ fn main', ' a', '-b', '+B', '+c', ' d', '@@ -20 +21 @@', '-x', '+y']
    expect(diffRows(lines)).toEqual([
      { kind: 'hunk', oldNo: null, newNo: null, text: '@@ -3,3 +3,4 @@ fn main' },
      { kind: 'context', oldNo: 3, newNo: 3, text: 'a' },
      { kind: 'del', oldNo: 4, newNo: null, text: 'b' },
      { kind: 'add', oldNo: null, newNo: 4, text: 'B' },
      { kind: 'add', oldNo: null, newNo: 5, text: 'c' },
      { kind: 'context', oldNo: 5, newNo: 6, text: 'd' },
      { kind: 'hunk', oldNo: null, newNo: null, text: '@@ -20 +21 @@' },
      { kind: 'del', oldNo: 20, newNo: null, text: 'x' },
      { kind: 'add', oldNo: null, newNo: 21, text: 'y' },
    ])
  })

  it('leaves notes unnumbered and counts lines without a hunk header from 1', () => {
    expect(diffRows([' a', '-b', '\\ No newline at end of file', '+c'])).toEqual([
      { kind: 'context', oldNo: 1, newNo: 1, text: 'a' },
      { kind: 'del', oldNo: 2, newNo: null, text: 'b' },
      { kind: 'note', oldNo: null, newNo: null, text: '\\ No newline at end of file' },
      { kind: 'add', oldNo: null, newNo: 2, text: 'c' },
    ])
  })
})

describe('diffBlocks', () => {
  it('pairs the deletions of a change with its additions row by row, notes staying on their side', () => {
    const rows = diffRows([
      '@@ -1,6 +1,5 @@',
      ' a',
      '-b',
      '-c',
      '+B',
      ' d',
      '+e',
      ' f',
      '-g',
      '\\ No newline at end of file',
      '+G',
      '\\ No newline at end of file',
    ])
    expect(diffBlocks(rows)).toEqual([
      {
        change: false,
        rows: [0, 1],
        pairs: [
          [0, 0],
          [1, 1],
        ],
      },
      {
        change: true,
        rows: [2, 3, 4],
        pairs: [
          [2, 4],
          [3, null],
        ],
      },
      { change: false, rows: [5], pairs: [[5, 5]] },
      { change: true, rows: [6], pairs: [[null, 6]] },
      { change: false, rows: [7], pairs: [[7, 7]] },
      {
        change: true,
        rows: [8, 9, 10, 11],
        pairs: [
          [8, 10],
          [9, 11],
        ],
      },
    ])
  })

  it('pairs additions listed before their deletions, and keeps a note after context on both sides', () => {
    expect(diffBlocks(diffRows(['+x', '-y', ' z', '\\ No newline at end of file']))).toEqual([
      { change: true, rows: [0, 1], pairs: [[1, 0]] },
      {
        change: false,
        rows: [2, 3],
        pairs: [
          [2, 2],
          [3, 3],
        ],
      },
    ])
  })
})
