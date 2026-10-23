import type { DiffRow } from './patch'

/** Rows kept together: a change (the deletions and additions between context lines) or a run of other rows. */
export interface DiffBlock {
  change: boolean
  /** Row indices in patch order, as the unified view shows them. */
  rows: number[]
  /** The same rows side by side as [old, new] row indices; null leaves that side empty. */
  pairs: [number | null, number | null][]
}

/**
 * Groups rows into blocks. Side by side, a change lists its deletions left and its additions right, paired row by
 * row; a note (no newline at end of file) stays on the side of the line before it; other rows fill both sides.
 */
export function diffBlocks(rows: DiffRow[]): DiffBlock[] {
  const blocks: DiffBlock[] = []
  const sides: [number[], number[]] = [[], []]
  let side: 0 | 1 = 0
  const pair = (b: DiffBlock) => {
    for (let k = 0; k < Math.max(sides[0].length, sides[1].length); k++)
      b.pairs.push([sides[0][k] ?? null, sides[1][k] ?? null])
    sides[0] = []
    sides[1] = []
  }
  rows.forEach((row, i) => {
    let block = blocks.at(-1)
    const change = row.kind === 'add' || row.kind === 'del' || (row.kind === 'note' && !!block?.change)
    if (block?.change !== change) {
      if (block?.change) pair(block)
      block = { change, rows: [], pairs: [] }
      blocks.push(block)
    }
    block.rows.push(i)
    if (!change) block.pairs.push([i, i])
    else {
      if (row.kind !== 'note') side = row.kind === 'del' ? 0 : 1
      sides[side].push(i)
    }
  })
  const last = blocks.at(-1)
  if (last?.change) pair(last)
  return blocks
}
