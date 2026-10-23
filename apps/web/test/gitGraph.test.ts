import { describe, expect, it } from 'vitest'
import {
  GRAPH_COLORS,
  type GraphCommit,
  type GraphLine,
  type GraphRow,
  layoutGraph,
} from '../src/features/git/graph'

/** Commits newest first, each written `hash parent…`. */
const log = (...specs: string[]): GraphCommit[] =>
  specs.map((spec) => {
    const [hash = '', ...parents] = spec.split(' ')
    return { hash, parents }
  })

/** A line as `T1>0` (top half, from lane 1 to lane 0) or `B0>0`. */
const seg = (l: GraphLine) => `${l.part === 'top' ? 'T' : 'B'}${l.from}>${l.to}`
/** Each row as `node: lines`, the lines sorted. */
const shape = (rows: GraphRow[]) => rows.map((r) => [`${r.lane}:`, ...r.lines.map(seg).sort()].join(' '))

/** The lanes crossing a row's top or bottom edge, as `lane:color`. */
const edge = (row: GraphRow, part: GraphLine['part']) =>
  [
    ...new Set(
      row.lines.filter((l) => l.part === part).map((l) => `${part === 'top' ? l.from : l.to}:${l.color}`),
    ),
  ].sort()

/** Where rows do not fit together: a lane cut at a row edge, or a line turning in the middle away from the node. */
const breaks = (rows: GraphRow[]) =>
  rows.flatMap((row, i) => {
    const above = i ? edge(rows[i - 1]!, 'bottom') : []
    const cut = edge(row, 'top').join() === above.join() ? [] : [`row ${i}: lanes cut`]
    const stray = row.lines.some((l) => {
      const [middle, end] = l.part === 'top' ? [l.to, l.from] : [l.from, l.to]
      return middle !== row.lane && middle !== end
    })
    return stray ? [...cut, `row ${i}: line off the node`] : cut
  })

/** `branches` long-lived branches commit in turn from one root and now and then merge the next one in. */
function history(size: number, branches: number): GraphCommit[] {
  const tips = Array<string>(branches).fill('c0')
  const commits: GraphCommit[] = [{ hash: 'c0', parents: [] }]
  for (let i = 1; i < size; i++) {
    const b = (i * 7) % branches
    const parents = [tips[b]!]
    if (i % 5 === 0) parents.push(tips[(b + 1) % branches]!)
    tips[b] = `c${i}`
    commits.push({ hash: `c${i}`, parents })
  }
  return commits.reverse()
}

describe('layoutGraph', () => {
  it('keeps a linear history in one lane', () => {
    const rows = layoutGraph(log('d c', 'c b', 'b a', 'a'))
    expect(shape(rows)).toEqual(['0: B0>0', '0: B0>0 T0>0', '0: B0>0 T0>0', '0: T0>0'])
    expect(rows.map((r) => r.width)).toEqual([1, 1, 1, 1])
    expect(new Set(rows.flatMap((r) => [r.color, ...r.lines.map((l) => l.color)]))).toEqual(new Set([0]))
  })

  it('gives a merged branch its own lane that rejoins where it forked', () => {
    const rows = layoutGraph(log('m a b', 'b a', 'a'))
    expect(shape(rows)).toEqual(['0: B0>0 B0>1', '1: B0>0 B1>1 T0>0 T1>1', '0: T0>0 T1>0'])
    expect(rows.map((r) => r.width)).toEqual([2, 2, 2])
  })

  it('converges the lanes of several children into their parent', () => {
    const rows = layoutGraph(log('c a', 'b a', 'a'))
    expect(shape(rows)).toEqual(['0: B0>0', '1: B0>0 B1>1 T0>0', '0: T0>0 T1>0'])
  })

  it('fans an octopus merge out into a lane per parent', () => {
    const rows = layoutGraph(log('o a b c', 'c r', 'b r', 'a r', 'r'))
    expect(shape(rows)).toEqual([
      '0: B0>0 B0>1 B0>2',
      '2: B0>0 B1>1 B2>2 T0>0 T1>1 T2>2',
      '1: B0>0 B1>1 B2>2 T0>0 T1>1 T2>2',
      '0: B0>0 B1>1 B2>2 T0>0 T1>1 T2>2',
      '0: T0>0 T1>0 T2>0',
    ])
    expect(rows[0]!.lines.filter((l) => l.from !== l.to).map((l) => [l.to, l.color])).toEqual([
      [1, 1],
      [2, 2],
    ])
  })

  it('joins a merge edge into the lane already waiting for that parent', () => {
    const rows = layoutGraph(log('x b', 'm c b', 'c b', 'b'))
    expect(shape(rows)).toEqual([
      '0: B0>0',
      '1: B0>0 B1>0 B1>1 T0>0',
      '1: B0>0 B1>1 T0>0 T1>1',
      '0: T0>0 T1>0',
    ])
  })

  it('opens the lane of a merged parent right of the merge commit', () => {
    // p frees lane 0 before m comes; s still goes to the right of m.
    const rows = layoutGraph(log('a p', 'b m', 'p', 'm q s', 'q', 's'))
    expect(shape(rows)[3]).toBe('1: B1>1 B1>2 T1>1')
  })

  it('reuses the slot of an ended lane and trims free lanes on the right', () => {
    // b's lane ends where it forks off x; s, a tip further down, takes its slot.
    const rows = layoutGraph(log('a x', 'b x', 'c r', 'x r', 's r', 'r'))
    expect(rows.map((r) => r.lane)).toEqual([0, 1, 2, 0, 1, 0])
    expect(rows.map((r) => r.width)).toEqual([1, 2, 3, 3, 3, 3])
    expect(layoutGraph(log('c b', 'x b', 'b a', 'a')).map((r) => r.width)).toEqual([1, 2, 2, 1])
    // A merged parent takes a slot that ended in the same row.
    expect(layoutGraph(log('m2 m1 g1', 'g1 m1', 'm1 m0 f1', 'f1 m0', 'm0')).map((r) => r.lane)).toEqual([
      0, 1, 0, 1, 0,
    ])
  })

  it('keeps a lane in one color for its whole life', () => {
    const rows = layoutGraph(log('m c b', 'c a', 'b a', 'a'))
    const main = rows[0]!.color
    const side = rows[2]!.color
    expect(side).not.toBe(main)
    expect(rows.map((r) => r.color)).toEqual([main, main, side, main])
    for (const l of rows.flatMap((r) => r.lines))
      expect(l.color).toBe(l.from === 1 || l.to === 1 ? side : main)
  })

  it('cycles eight colors as lanes start', () => {
    const tips = Array.from({ length: GRAPH_COLORS + 1 }, (_, i) => `t${i} r`)
    expect(layoutGraph(log(...tips, 'r')).map((r) => r.color)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 0])
  })

  it('runs the lane of a parent missing from the list (a filtered log) down to the last row', () => {
    const rows = layoutGraph(log('k1 p1', 'k2 p2', 'k3 k4 p3', 'k4 p4'))
    expect(shape(rows)).toEqual([
      '0: B0>0',
      '1: B0>0 B1>1 T0>0',
      '2: B0>0 B1>1 B2>2 B2>3 T0>0 T1>1',
      '2: B0>0 B1>1 B2>2 B3>3 T0>0 T1>1 T2>2 T3>3',
    ])
  })

  it('tolerates odd input', () => {
    expect(layoutGraph([])).toEqual([])
    expect(shape(layoutGraph(log('m a a', 'a')))).toEqual(['0: B0>0', '0: T0>0'])
    // A parent listed above its child, and a commit listed twice.
    expect(shape(layoutGraph(log('b a', 'a', 'c b', 'a')))).toEqual([
      '0: B0>0',
      '0: T0>0',
      '0: B0>0',
      '1: B0>0 T0>0',
    ])
  })

  it('keeps the loaded rows as they were when the next page comes', () => {
    const page = log('m c b', 'c a')
    expect(layoutGraph([...page, ...log('b a', 'a')]).slice(0, page.length)).toEqual(layoutGraph(page))
  })

  it('lays out 5000 commits quickly, in connected rows and a lane per branch', () => {
    const commits = history(5000, 6)
    layoutGraph(commits)
    const start = performance.now()
    const rows = layoutGraph(commits)
    expect(performance.now() - start).toBeLessThan(100)
    expect(rows).toHaveLength(5000)
    expect(Math.max(...rows.map((r) => r.width))).toBe(6)
    expect(breaks(rows)).toEqual([])
    expect(edge(rows.at(-1)!, 'bottom')).toEqual([])
  })
})
