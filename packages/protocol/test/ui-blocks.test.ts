import { describe, expect, it } from 'vitest'
import { findUiBlocks, parseUiBlock, summarizeUiBlock, WIDGET_MAX } from '../src/index.js'

describe('ui blocks', () => {
  it('parses valid blocks and leaves invalid ones as code', () => {
    expect(
      parseUiBlock('chart', '{"type":"line","x":["10:00","11:00"],"series":[{"name":"CPU","data":[35,52]}]}'),
    ).toMatchObject({
      lang: 'chart',
      data: { type: 'line', series: [{ name: 'CPU' }] },
    })
    expect(parseUiBlock('chart', '{"type":"radar","x":[],"series":[]}')).toBeNull()
    expect(parseUiBlock('metrics', 'not json')).toBeNull()
    expect(parseUiBlock('actions', '{"options":[{"label":"扩容"}]}')).toEqual({
      lang: 'actions',
      data: { id: 'actions', options: [{ label: '扩容' }] },
    })
    expect(parseUiBlock('ts', 'const a = 1')).toBeNull()
    expect(parseUiBlock('widget', 'x'.repeat(WIDGET_MAX + 1))).toBeNull()
  })

  it('finds closed blocks in a reply and summarizes them', () => {
    const md =
      '结论如下\n\n```metrics\n[{"label":"CPU","value":78,"unit":"%"}]\n```\n\n```ts\nx\n```\n\n```chart\n{"type":"bar"'
    const found = findUiBlocks(md)
    expect(found).toHaveLength(1)
    expect(summarizeUiBlock(found[0]!.block)).toBe('CPU 78%')
    expect(md.slice(found[0]!.start, found[0]!.end)).toMatch(/^```metrics[\s\S]*```$/)
  })
})
