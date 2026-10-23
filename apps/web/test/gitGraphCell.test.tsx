import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraphCell } from '../src/features/git/GraphCell'
import { GRAPH_LANE_WIDTH, GRAPH_ROW_HEIGHT, type GraphRow, layoutGraph } from '../src/features/git/graph'

// m merges b, which forked off a.
const [merge, side, fork] = layoutGraph([
  { hash: 'm', parents: ['a', 'b'] },
  { hash: 'b', parents: ['a'] },
  { hash: 'a', parents: [] },
]) as [GraphRow, GraphRow, GraphRow]

const svg = (row: GraphRow, props: { height?: number; laneWidth?: number; merge?: boolean } = {}) =>
  render(<GraphCell row={row} {...props} />).container.querySelector('svg')!

const paths = (el: SVGSVGElement) =>
  [...el.querySelectorAll('path')].map((p) => `${p.getAttribute('class')} ${p.getAttribute('d')}`).sort()

describe('GraphCell', () => {
  it('sizes the svg to the lanes of its row, 26 high and 14 a lane by default', () => {
    expect([GRAPH_ROW_HEIGHT, GRAPH_LANE_WIDTH]).toEqual([26, 14])
    const el = svg(side)
    expect([el.getAttribute('width'), el.getAttribute('height')]).toEqual(['28', '26'])
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(svg(merge, { height: 30, laneWidth: 10 }).getAttribute('width')).toBe('20')
    expect(svg({ lane: 0, color: 0, lines: [], width: 0 }).getAttribute('width')).toBe('14')
  })

  it('paints the node in the middle of its lane, over a path per line', () => {
    const el = svg(side)
    expect(el.querySelectorAll('path')).toHaveLength(side.lines.length)
    const nodes = el.querySelectorAll('circle')
    expect(nodes).toHaveLength(1)
    const node = nodes[0]!
    expect([node.getAttribute('cx'), node.getAttribute('cy')]).toEqual(['21', '13'])
    expect(node.classList.contains(`git-graph__c${side.color}`)).toBe(true)
    expect(el.lastElementChild).toBe(node)
  })

  it('draws straight segments as vertical lines and lane changes as curves, in their lane colors', () => {
    expect(paths(svg(merge))).toEqual(['git-graph__c0 M7 13V26', 'git-graph__c1 M7 13C7 19.5 21 19.5 21 26'])
    expect(paths(svg(fork))).toEqual(['git-graph__c0 M7 0V13', 'git-graph__c1 M21 0C21 6.5 7 6.5 7 13'])
  })

  it('draws a merge commit hollow', () => {
    expect(svg(merge, { merge: true }).querySelector('circle')!.classList).toContain('git-graph__node--merge')
    expect(svg(side).querySelector('circle')!.classList).not.toContain('git-graph__node--merge')
  })
})
