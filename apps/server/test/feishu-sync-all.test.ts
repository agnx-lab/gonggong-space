import type { GroupFeishuView, MessageDto } from '@gonggong/protocol'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { feishuIdentities, feishuMessageLinks, messages, runs, systemParams } from '../src/db/schema.js'
import { seal } from '../src/lib/seal.js'
import { forgetSysParams } from '../src/modules/admin/params.js'
import { feishuIdle } from '../src/modules/feishu/mirror.js'
import { createTestApp, type TestApp } from './support/app.js'
import type { FakeUser } from './support/feishu.js'
import { client } from './support/http.js'

let t: TestApp
beforeEach(async () => {
  t = await createTestApp()
})
afterEach(() => t.close())

const MAIN = 'cli_main'
const BOT_APP = 'cli_bot1'
const CHAT = 'oc_chat1'

async function link(userId: string): Promise<FakeUser> {
  const fu = t.feishu.user()
  await t.db.insert(feishuIdentities).values({
    userId,
    unionId: fu.unionId,
    openId: fu.openId,
    name: fu.name,
    accessToken: seal('tok'),
  })
  return fu
}

/** A group with a bot bound to CHAT; the main app is in the chat and gets all of its user messages. */
async function setup() {
  const admin = await t.seed.user({ role: 'sysadmin' })
  const owner = await t.seed.user({ name: '王磊' })
  const { machine } = await t.seed.machine(owner.id)
  const bot = await t.seed.bot({ ownerId: owner.id, machineId: machine.id, name: 'codex' })
  const group = await t.seed.group({ createdBy: owner.id, botIds: [bot.id] })
  const adminHttp = client(t, await t.seed.cookie(admin.id))
  const ownerHttp = client(t, await t.seed.cookie(owner.id))
  t.feishu.chats.set(MAIN, [{ chatId: CHAT, name: '研发群', avatar: null }])
  t.feishu.chats.set(BOT_APP, [{ chatId: CHAT, name: '研发群', avatar: null }])
  expect((await adminHttp.put('/api/admin/feishu', { appId: MAIN, appSecret: 's' })).status).toBe(200)
  expect((await ownerHttp.put(`/api/bots/${bot.id}/feishu`, { appId: BOT_APP, appSecret: 's' })).status).toBe(
    200,
  )
  await t.db.insert(systemParams).values({ key: 'publicUrl', value: 'https://gg.example.com' })
  forgetSysParams(t.db)
  const ownerFs = await link(owner.id)
  const guest = t.feishu.user({ name: '外部同事' })
  t.feishu.members.set(CHAT, [ownerFs.unionId, guest.unionId])
  expect((await ownerHttp.put(`/api/groups/${group.id}/feishu`, { chatId: CHAT })).status).toBe(200)
  return { owner, bot, group, ownerHttp, ownerFs, guest }
}

const stored = (groupId: string) =>
  t.db.select().from(messages).where(eq(messages.groupId, groupId)).orderBy(messages.seq)

async function say(appId: string, o: Parameters<typeof t.feishu.message>[1]) {
  const sent = t.feishu.message(appId, o)
  await sent.done
  await feishuIdle(t.ctx)
  return sent.messageId
}

describe('同步全部飞书消息', () => {
  it('is on for a newly bound chat and turned off by a group admin', async () => {
    const { group, ownerHttp } = await setup()
    const view = (await ownerHttp.get<GroupFeishuView>(`/api/groups/${group.id}/feishu`)).body
    expect(view.chat).toMatchObject({ syncAll: true, syncOutbound: true })
    const off = await ownerHttp.patch<GroupFeishuView>(`/api/groups/${group.id}/feishu`, { syncAll: false })
    expect(off.body.chat).toMatchObject({ syncAll: false, syncOutbound: true })
  })

  it('stores a plain message from a member as theirs, marked from Feishu, without running any bot', async () => {
    const { owner, group, ownerFs, ownerHttp } = await setup()
    await say(MAIN, { chatId: CHAT, from: ownerFs, text: '今天先看登录页' })
    const m = (await stored(group.id)).at(-1)
    expect(m).toMatchObject({ kind: 'user', authorUserId: owner.id, body: '今天先看登录页' })
    expect(await t.db.select().from(runs)).toEqual([])
    const list = (await ownerHttp.get<{ messages: MessageDto[] }>(`/api/groups/${group.id}/timeline`)).body
      .messages
    expect(list.at(-1)).toMatchObject({
      authorId: owner.id,
      authorName: '王磊',
      fromFeishu: true,
      mentions: [],
    })
  })

  it('tells the group once, before the first synced message, that Feishu messages now come in', async () => {
    const { group, ownerFs } = await setup()
    await say(MAIN, { chatId: CHAT, from: ownerFs, text: '一' })
    await say(MAIN, { chatId: CHAT, from: ownerFs, text: '二' })
    const all = await stored(group.id)
    expect(all.map((m) => [m.kind, m.kind === 'event' ? 'notice' : m.body])).toEqual([
      ['event', 'notice'],
      ['user', '一'],
      ['user', '二'],
    ])
    expect(all[0]!.body).toContain('飞书群里的消息现在会全部同步到本群')
  })

  it('stores a sender without a 共工 account under their Feishu name', async () => {
    const { group, guest, ownerHttp } = await setup()
    await say(MAIN, { chatId: CHAT, from: guest, text: '我这边接口好了' })
    const m = (await stored(group.id)).at(-1)
    expect(m).toMatchObject({ kind: 'user', authorUserId: null, body: '我这边接口好了' })
    const list = (await ownerHttp.get<{ messages: MessageDto[] }>(`/api/groups/${group.id}/timeline`)).body
      .messages
    expect(list.at(-1)).toMatchObject({ authorId: null, authorName: '外部同事', fromFeishu: true })
  })

  it('stores nothing when turned off', async () => {
    const { group, ownerFs, ownerHttp } = await setup()
    await ownerHttp.patch(`/api/groups/${group.id}/feishu`, { syncAll: false })
    await say(MAIN, { chatId: CHAT, from: ownerFs, text: '闲聊' })
    expect(await stored(group.id)).toEqual([])
  })

  it('skips what 共工 itself sent to the chat', async () => {
    const { group, ownerFs } = await setup()
    await t.db
      .insert(feishuMessageLinks)
      .values({ feishuMessageId: 'om_out', chatId: CHAT, appId: MAIN, direction: 'out', kind: 'message' })
    await say(MAIN, { chatId: CHAT, from: ownerFs, text: 'echo', messageId: 'om_out' })
    expect(await stored(group.id)).toEqual([])
  })

  it('an @ delivered by the main app first is stored once and still runs the bot', async () => {
    const { group, ownerFs, bot } = await setup()
    const at = [{ key: '@_user_1', name: 'codex', openId: 'ou_bot' }]
    const o = { chatId: CHAT, from: ownerFs, text: '@_user_1 修一下', mentions: at, messageId: 'om_at' }
    await say(MAIN, o)
    await say(BOT_APP, o)
    await say(MAIN, o)
    const all = (await stored(group.id)).filter((m) => m.kind === 'user')
    expect(all).toHaveLength(1)
    expect(all[0]!.meta).toMatchObject({ mentions: [bot.id] })
    const started = await t.db.select().from(runs).where(eq(runs.triggerMessageId, all[0]!.id))
    expect(started.map((r) => r.botId)).toEqual([bot.id])
  })

  it('a Feishu recall recalls a synced message, also one without a 共工 author', async () => {
    const { group, guest } = await setup()
    const messageId = await say(MAIN, { chatId: CHAT, from: guest, text: '发错了' })
    await t.feishu.recalled(MAIN, { messageId, chatId: CHAT })
    const m = (await stored(group.id)).at(-1)
    expect(m?.recalledAt).not.toBeNull()
    expect(m?.body).toBe('')
  })
})
