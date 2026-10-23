import { describe, expect, it } from 'vitest'
import {
  assemble,
  hasMarkers,
  parseMerge,
  type Resolution,
  resolved,
  sameOnBothSides,
} from '../src/features/git/merge'

const MERGED = [
  'const a = 1',
  '<<<<<<< ours',
  'const fee = 2',
  '||||||| base',
  'const fee = 1',
  '=======',
  'const fee = 3',
  '>>>>>>> theirs',
  'const b = 2',
  '<<<<<<< ours',
  '||||||| base',
  'old()',
  '=======',
  'renamed()',
  'extra()',
  '>>>>>>> theirs',
  '',
].join('\n')

describe('three-way merge segments', () => {
  it("splits git's diff3 output into agreed runs and conflicts with ours, base and theirs", () => {
    expect(parseMerge(MERGED)).toEqual([
      { kind: 'same', lines: ['const a = 1'] },
      {
        kind: 'conflict',
        id: 0,
        ours: ['const fee = 2'],
        base: ['const fee = 1'],
        theirs: ['const fee = 3'],
      },
      { kind: 'same', lines: ['const b = 2'] },
      { kind: 'conflict', id: 1, ours: [], base: ['old()'], theirs: ['renamed()', 'extra()'] },
      { kind: 'same', lines: [''] },
    ])
  })

  it('reads conflicts without a base section and gives up on markers that do not nest', () => {
    expect(parseMerge('<<<<<<< ours\na\n=======\nb\n>>>>>>> theirs')).toEqual([
      { kind: 'conflict', id: 0, ours: ['a'], base: [], theirs: ['b'] },
    ])
    expect(parseMerge('<<<<<<< ours\na\n<<<<<<< ours\n')).toBeNull()
    expect(parseMerge('a\n=======\nb')).toBeNull()
    expect(parseMerge('<<<<<<< ours\na\n=======\nb')).toBeNull()
    // Seven = in the middle of text without an open conflict is not a marker to git either.
    expect(parseMerge('a\n======= \nb')).toEqual([{ kind: 'same', lines: ['a', '======= ', 'b'] }])
  })

  it('assembles the resolutions, both sides in either order or typed text, keeping markers for open ones', () => {
    const segs = parseMerge(MERGED) ?? []
    const all = new Map<number, Resolution>([
      [0, 'theirs'],
      [1, 'ours-theirs'],
    ])
    expect(assemble(segs, all)).toBe('const a = 1\nconst fee = 3\nconst b = 2\nrenamed()\nextra()\n')
    const partial = new Map<number, Resolution>([[1, { text: 'merged()' }]])
    const text = assemble(segs, partial)
    expect(text).toBe(
      'const a = 1\n<<<<<<< ours\nconst fee = 2\n=======\nconst fee = 3\n>>>>>>> theirs\nconst b = 2\nmerged()\n',
    )
    expect(hasMarkers(text)).toBe(true)
    expect(hasMarkers(assemble(segs, all))).toBe(false)
  })

  it('resolves one conflict to a side, both, or nothing', () => {
    const c = { kind: 'conflict' as const, id: 0, ours: ['x'], base: [], theirs: ['y'] }
    expect(resolved(c, 'theirs-ours')).toEqual(['y', 'x'])
    expect(resolved(c, { text: '' })).toEqual([])
    expect(sameOnBothSides(c)).toBe(false)
    expect(sameOnBothSides({ ...c, theirs: ['x'] })).toBe(true)
  })
})
