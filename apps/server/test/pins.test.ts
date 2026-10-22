import type { GroupPinsDto, MessageDto, TimelineDto } from '@gonggong/protocol'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { messages } from '../src/db/schema.js'
import { createTestApp, type TestApp } from './support/app.js'
import { client, events } from './support/http.js'

let t: TestApp
beforeEach(async () => {
  t = await createTestApp()
})
afterEach(() => t.close())

async function world() {
  const wang = await t.seed.user({ name: '王磊' })
  const li = await t.seed.user({ name: '李建国' })
  const outsider = await t.seed.user({ name: '赵敏' })
  const g = await t.seed.group({ createdBy: wang.id, name: '支付', memberIds: [li.id] })
  const other = await t.seed.group({ createdBy: wang.id, name: '其他' })
  const say = async (body: string, o: { groupId?: string; kind?: string; meta?: object } = {}) => {
    const [m] = await t.db
      .insert(messages)
      .values({
        groupId: o.groupId ?? g.id,
        kind: o.kind ?? 'user',
        authorUserId: o.kind === 'event' ? null : wang.id,
        body,
        meta: o.meta ?? {},
      })
      .returning()
    return m!
  }
  const asWang = client(t, await t.seed.cookie(wang.id))
  const asLi = client(t, await t.seed.cookie(li.id))
  const asOutsider = client(t, await t.seed.cookie(outsider.id))
  const pins = async (as = asWang) => (await as.get<GroupPinsDto>(`/api/groups/${g.id}/pins`)).body.pins
  const pin = (as: typeof asWang, messageId: string) => as.post(`/api/groups/${g.id}/pins`, { messageId })
  const unpin = (as: typeof asWang, messageId: string) => as.del(`/api/groups/${g.id}/pins/${messageId}`)
  const timeline = async () =>
    (await asWang.get<TimelineDto>(`/api/groups/${g.id}/timeline`)).body.messages.map((m) => m.body)
  return { wang, li, g, other, say, asWang, asLi, asOutsider, pins, pin, unpin, timeline }
}

describe('消息置顶', () => {
  it('any member pins and unpins; members see the list, newest first, and an event each time', async () => {
    const w = await world()
    const a = await w.say('上线窗口：周四 20:00')
    const b = await w.say('', {
      meta: {
        attachments: [{ id: 'x', name: 'spec.pdf', size: 3, mime: 'application/pdf', messageId: 'm' }],
      },
    })
    const seen = events(t, w.wang.id)

    expect((await w.pin(w.asLi, a.id)).status).toBe(200)
    expect((await w.pin(w.asWang, b.id)).status).toBe(200)
    const list = await w.pins(w.asLi)
    expect(list.map((p) => p.messageId)).toEqual([b.id, a.id])
    expect(list[1]).toMatchObject({
      seq: a.seq,
      authorName: '王磊',
      text: '上线窗口：周四 20:00',
      attachments: 0,
      pinnedBy: { id: w.li.id, name: '李建国' },
    })
    expect(list[0]).toMatchObject({ text: '', attachments: 1 })
    expect(seen.filter((e) => e.t === 'group.pins').at(-1)).toMatchObject({ groupId: w.g.id, pins: list })
    expect(await w.timeline()).toContain('李建国 置顶了一条消息：上线窗口：周四 20:00')

    expect((await w.pin(w.asWang, a.id)).status).toBe(200)
    expect((await w.pins()).length).toBe(2)

    expect((await w.unpin(w.asWang, a.id)).status).toBe(204)
    expect((await w.pins()).map((p) => p.messageId)).toEqual([b.id])
    expect(await w.timeline()).toContain('王磊 取消置顶了一条消息：上线窗口：周四 20:00')
  })

  it('refuses a sixth pin with a clear reason instead of replacing one', async () => {
    const w = await world()
    for (let i = 0; i < 5; i++)
      expect((await w.pin(w.asWang, (await w.say(`第 ${i} 条`)).id)).status).toBe(200)
    const sixth = await w.pin(w.asWang, (await w.say('第 6 条')).id)
    expect(sixth.status).toBe(409)
    expect(JSON.stringify(sixth.body)).toContain('最多置顶 5 条')
    expect((await w.pins()).length).toBe(5)
  })

  it('refuses outsiders, other groups’ messages, recalled messages and events', async () => {
    const w = await world()
    const a = await w.say('要点')
    expect((await w.pin(w.asOutsider, a.id)).status).toBe(404)
    expect((await w.asOutsider.get(`/api/groups/${w.g.id}/pins`)).status).toBe(404)
    expect((await w.pin(w.asWang, (await w.say('别处', { groupId: w.other.id })).id)).status).toBe(404)
    expect((await w.pin(w.asWang, (await w.say('系统事件', { kind: 'event' })).id)).status).toBe(409)
    await w.asWang.post<MessageDto>(`/api/messages/${a.id}/recall`)
    expect((await w.pin(w.asWang, a.id)).status).toBe(409)
  })

  it('a recalled message drops out of the pins', async () => {
    const w = await world()
    const a = await w.say('要点')
    await w.pin(w.asLi, a.id)
    const seen = events(t, w.li.id)
    expect((await w.asWang.post(`/api/messages/${a.id}/recall`)).status).toBe(200)
    expect(await w.pins()).toEqual([])
    expect(seen.filter((e) => e.t === 'group.pins').at(-1)).toMatchObject({ pins: [] })
  })
})
