import type { ContextMessage } from '@gonggong/protocol'
import { describe, expect, it } from 'vitest'
import { estimateTokens, fitBudget, messageTokens } from '../src/modules/runs/context-budget.js'

const msg = (seq: number, body: string, attachments: ContextMessage['attachments'] = []): ContextMessage => ({
  seq,
  author: '王磊',
  kind: 'user',
  body,
  at: '2026-01-01T00:00:00.000Z',
  attachments,
})

describe('estimateTokens', () => {
  it('counts CJK and full-width characters as one token each and other text as four characters per token', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('你好世界')).toBe(4)
    expect(estimateTokens('，！')).toBe(2)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('改 bugs')).toBe(3)
    expect(estimateTokens('𠀀')).toBe(1)
  })
})

describe('messageTokens', () => {
  it('adds the rendered prefix and attachment names to the body', () => {
    const plain = messageTokens(msg(12, 'hi'))
    expect(plain).toBeGreaterThan(estimateTokens('hi'))
    const file = { id: 'a', name: '需求文档.pdf', size: 1, mime: 'application/pdf', messageId: 'm' }
    expect(messageTokens(msg(12, 'hi', [file]))).toBeGreaterThan(plain + estimateTokens('需求文档.pdf'))
  })
})

describe('fitBudget', () => {
  it('keeps the newest messages while they fit and stops at the first that does not', () => {
    const rows = [msg(4, '四'.repeat(10)), msg(3, '三'.repeat(10)), msg(2, '二'.repeat(500)), msg(1, '一')]
    const budget = messageTokens(rows[0] as ContextMessage) + messageTokens(rows[1] as ContextMessage) + 5
    const { kept, complete } = fitBudget(rows, budget)
    expect(kept.map((m) => m.seq)).toEqual([4, 3])
    expect(complete).toBe(false)
  })

  it('reports complete when every row fits', () => {
    const rows = [msg(2, 'b'), msg(1, 'a')]
    expect(fitBudget(rows, 1000)).toEqual({ kept: rows, complete: true })
  })

  it('clips the newest message to the budget when it alone does not fit', () => {
    const { kept, complete } = fitBudget([msg(9, '长'.repeat(5000)), msg(8, 'x')], 1000)
    expect(complete).toBe(false)
    expect(kept).toHaveLength(1)
    const [clipped] = kept as [ContextMessage]
    expect(clipped.seq).toBe(9)
    expect(clipped.body.startsWith('长'.repeat(100))).toBe(true)
    expect(clipped.body.endsWith('…（已截断，全文用 list_messages(around=9) 查看）')).toBe(true)
    expect(messageTokens(clipped)).toBeLessThanOrEqual(1000)
    expect(messageTokens(clipped)).toBeGreaterThan(950)
  })
})
