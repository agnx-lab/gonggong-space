import { describe, expect, it } from 'vitest'
import { liveRunOf } from '../src/index.js'

const run = (o: Partial<Parameters<typeof liveRunOf>[0]> = {}) => ({
  id: 'r1',
  botId: 'b1',
  status: 'running' as const,
  originUserId: 'trigger',
  approvals: [],
  questions: [],
  ...o,
})

describe('liveRunOf', () => {
  it('a pending approval needs the bot owner only, titled by its command', () => {
    const r = run({
      status: 'awaiting_approval',
      approvals: [
        { status: 'approved', title: '执行命令', detail: 'ls' },
        { status: 'pending', title: '执行命令', detail: '\n rm -rf build \nmore' },
      ],
    })
    expect(liveRunOf(r, 'owner', 'owner')).toEqual({
      id: 'r1',
      botId: 'b1',
      status: 'awaiting_approval',
      needsMe: true,
      title: 'rm -rf build',
    })
    expect(liveRunOf(r, 'trigger', 'owner').needsMe).toBe(false)
    const bare = run({
      status: 'awaiting_approval',
      approvals: [{ status: 'pending', title: '写入文件', detail: '' }],
    })
    expect(liveRunOf(bare, 'owner', 'owner').title).toBe('写入文件')
  })

  it('a pending question needs its trigger user or the owner', () => {
    const r = run({
      status: 'awaiting_answer',
      questions: [{ status: 'pending', questions: [{ title: '用哪个库？' }, { title: '备注' }] }],
    })
    expect(liveRunOf(r, 'trigger', 'owner')).toMatchObject({ needsMe: true, title: '用哪个库？' })
    expect(liveRunOf(r, 'owner', 'owner').needsMe).toBe(true)
    expect(liveRunOf(r, 'someone', 'owner').needsMe).toBe(false)
  })

  it('running and queued runs need nobody', () => {
    expect(liveRunOf(run({ status: 'queued' }), 'owner', 'owner')).toEqual({
      id: 'r1',
      botId: 'b1',
      status: 'queued',
      needsMe: false,
    })
  })
})
