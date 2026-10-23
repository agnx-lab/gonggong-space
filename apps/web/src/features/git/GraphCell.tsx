import { GRAPH_LANE_WIDTH, GRAPH_ROW_HEIGHT, type GraphLine, type GraphRow } from './graph'
import './graph.css'

/**
 * The commit graph in one log row (a row of `layoutGraph`). Its lines meet those of the rows around it at the top and
 * bottom edges, so the cell around it needs no vertical padding.
 */
export function GraphCell({
  row,
  height = GRAPH_ROW_HEIGHT,
  laneWidth = GRAPH_LANE_WIDTH,
  merge = false,
}: {
  row: GraphRow
  height?: number
  laneWidth?: number
  /** A merge commit, drawn hollow. */
  merge?: boolean
}) {
  const x = (lane: number) => (lane + 0.5) * laneWidth
  const middle = height / 2
  const path = ({ from, to, part }: GraphLine) => {
    const [y0, y1] = part === 'top' ? [0, middle] : [middle, height]
    if (from === to) return `M${x(from)} ${y0}V${y1}`
    // Leaves and arrives vertically, running on smoothly from the straight lines above and below.
    const y = (y0 + y1) / 2
    return `M${x(from)} ${y0}C${x(from)} ${y} ${x(to)} ${y} ${x(to)} ${y1}`
  }
  return (
    <svg className="git-graph" width={Math.max(row.width, 1) * laneWidth} height={height} aria-hidden="true">
      {row.lines.map((line) => (
        <path
          key={`${line.part}${line.from}-${line.to}`}
          className={`git-graph__c${line.color}`}
          d={path(line)}
        />
      ))}
      <circle
        className={`git-graph__node git-graph__c${row.color}${merge ? ' git-graph__node--merge' : ''}`}
        cx={x(row.lane)}
        cy={middle}
        r={3.5}
      />
    </svg>
  )
}
