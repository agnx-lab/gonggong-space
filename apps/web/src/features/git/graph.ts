/** Row height of the git log table and width of one graph lane, in px. */
export const GRAPH_ROW_HEIGHT = 26
export const GRAPH_LANE_WIDTH = 14
/** Lane colors cycle through `.git-graph__c0` … `.git-graph__c7` (graph.css). */
export const GRAPH_COLORS = 8

export interface GraphCommit {
  hash: string
  /** First parent first. */
  parents: readonly string[]
}

/**
 * A segment of one row. `top` runs from lane `from` at the row's top edge to lane `to` at its middle, where the node
 * sits; `bottom` from lane `from` at the middle to lane `to` at the bottom edge.
 */
export interface GraphLine {
  from: number
  to: number
  part: 'top' | 'bottom'
  color: number
}

export interface GraphRow {
  /** Lane of the commit's node. */
  lane: number
  color: number
  lines: GraphLine[]
  /** Lanes the row draws in, for sizing. */
  width: number
}

/** A lane runs down to the commit it waits for, in one color for its whole life. */
interface Lane {
  hash: string
  color: number
}

/**
 * Lays out commits listed newest first, each before its parents (`git log --date-order` or `--topo-order`). A row
 * depends only on the rows above it, so appending a page leaves the loaded rows as they were; a parent that is not
 * listed (not loaded yet, or filtered out) keeps its lane down to the last row.
 */
export function layoutGraph(commits: readonly GraphCommit[]): GraphRow[] {
  const lanes: (Lane | null)[] = []
  let started = 0
  const open = (hash: string): Lane => ({ hash, color: started++ % GRAPH_COLORS })
  const waiting = (hash: string): [number, Lane] | undefined => {
    const i = lanes.findIndex((lane) => lane?.hash === hash)
    const lane = lanes[i]
    return lane ? [i, lane] : undefined
  }
  const freeSlot = (from: number) => {
    let i = from
    while (lanes[i]) i++
    return i
  }

  return commits.map(({ hash, parents }) => {
    const lines: GraphLine[] = []
    const [node, own] = waiting(hash) ?? [freeSlot(0), open(hash)]
    for (const [i, lane] of lanes.entries()) {
      if (!lane) continue
      if (lane.hash === hash) {
        // Every lane waiting for this commit ends in its node: its own comes straight down, the others curve in.
        lines.push({ from: i, to: node, part: 'top', color: lane.color })
        lanes[i] = null
      } else {
        lines.push(
          { from: i, to: i, part: 'top', color: lane.color },
          { from: i, to: i, part: 'bottom', color: lane.color },
        )
      }
    }
    const [first, ...merged] = new Set(parents)
    if (first !== undefined) {
      own.hash = first
      lanes[node] = own
      lines.push({ from: node, to: node, part: 'bottom', color: own.color })
    }
    for (const parent of merged) {
      // A merged parent joins the lane already waiting for it, else opens one right of the node.
      const [to, lane] = waiting(parent) ?? [freeSlot(node + 1), open(parent)]
      lanes[to] = lane
      lines.push({ from: node, to, part: 'bottom', color: lane.color })
    }
    while (lanes.length && !lanes.at(-1)) lanes.pop()
    let width = node + 1
    for (const line of lines) width = Math.max(width, line.from + 1, line.to + 1)
    return { lane: node, color: own.color, lines, width }
  })
}
