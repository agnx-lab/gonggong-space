import { describe, expect, it } from 'vitest'
import { mentionedMembers, parseMentions } from '../src/index.js'

const bots = [
  { id: 'b1', name: '小王的 Claude' },
  { id: 'b2', name: '小王' },
  { id: 'b3', name: 'codex' },
  { id: 'b4', name: 'codex-2' },
]

describe('parseMentions', () => {
  it('matches names containing spaces', () => {
    expect(parseMentions('@小王的 Claude 写个脚本', bots)).toEqual(['b1'])
  })

  it('prefers the longest name at each @', () => {
    expect(parseMentions('@小王 看下，@codex-2 跑测试', bots)).toEqual(['b2', 'b4'])
    expect(parseMentions('@codex跑一下', bots)).toEqual(['b3'])
  })

  it('keeps mention order and dedupes', () => {
    expect(parseMentions('@codex 和 @小王的 Claude，再次 @codex', bots)).toEqual(['b3', 'b1'])
  })

  it('ignores unknown names, bare @ and email-like text', () => {
    expect(parseMentions('@李娜 看看 @ 这个 a@codex.com', bots)).toEqual([])
  })
})

describe('mentionedMembers', () => {
  const members = [
    { id: 'u1', name: '小王' },
    { id: 'u2', name: '陈晨' },
  ]
  it('finds members in order, deduped; a bot of a longer or the same name takes the @', () => {
    expect(
      mentionedMembers('@陈晨 看下 @小王的 Claude 的改动，@小王 也看 @陈晨', members, [bots[0]!]),
    ).toEqual(['u2', 'u1'])
    expect(mentionedMembers('@小王 看下', members, bots)).toEqual([])
  })

  it('skips code spans and fences when asked', () => {
    const body = '`@陈晨` 不算\n```\n@小王\n```\n@陈晨 算'
    expect(mentionedMembers(body, members, [], { skipCode: true })).toEqual(['u2'])
    expect(mentionedMembers('`@陈晨`', members, [])).toEqual(['u2'])
  })
})
