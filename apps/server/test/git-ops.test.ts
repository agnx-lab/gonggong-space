import {
  type FilesTreeDto,
  type FileTextDto,
  type GitCompareDto,
  type GitLogDto,
  type GitOperationDto,
  type GitOperationsDto,
  type GitRefsDto,
  PROTOCOL_VERSION,
  type ServerToDaemon,
} from '@gonggong/protocol'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditLogs, groupBots, groupRepos, groups, messages, notifications, runs } from '../src/db/schema.js'
import { expireGitOperations } from '../src/modules/git/service.js'
import { MASK } from '../src/modules/runs/redact.js'
import { createTestApp, inbox, type TestApp } from './support/app.js'
import { client, events } from './support/http.js'

let t: TestApp
let clock: Date
beforeEach(async () => {
  clock = new Date('2026-10-21T08:00:00Z')
  t = await createTestApp({ now: () => clock })
})
afterEach(() => t.close())

type GitAsk = Extract<ServerToDaemon, { t: `git.${string}` }>

async function daemon(token: string) {
  const ws = t.ws('/ws/daemon')
  const box = inbox(ws)
  await box.opened
  const send = (m: unknown) => ws.send(JSON.stringify(m))
  send({
    t: 'hello',
    protocol: PROTOCOL_VERSION,
    token,
    daemonVersion: '0.1.0',
    machine: { name: 'mbp', os: 'macos', arch: 'aarch64' },
    agents: [],
  })
  expect(await box.next()).toMatchObject({ t: 'welcome' })
  /** The next git request; hello may first trigger workspace messages. */
  const next = async <T extends GitAsk['t']>(type: T) => {
    for (;;) {
      const m = await box.next<ServerToDaemon>()
      if (m.t === type) return m as Extract<GitAsk, { t: T }>
    }
  }
  /** Answers the next git.action with ok / busy. */
  const act = async (
    o: { ok?: boolean; busy?: boolean; output?: string | null; error?: string | null } = {},
  ) => {
    const req = await next('git.action')
    send({
      t: 'git.action.result',
      requestId: req.requestId,
      ok: o.ok ?? true,
      busy: o.busy ?? false,
      output: o.output ?? 'done',
      error: o.error ?? null,
    })
    return req
  }
  return { send, next, act, close: () => ws.close() }
}

async function world() {
  const owner = await t.seed.user({ name: '王磊' })
  const member = await t.seed.user({ name: '陈晨' })
  const outsider = await t.seed.user({ name: '路人' })
  const { machine, token } = await t.seed.machine(owner.id)
  const bot = await t.seed.bot({ ownerId: owner.id, name: 'cc', machineId: machine.id })
  const group = await t.seed.group({ createdBy: owner.id, memberIds: [member.id], botIds: [bot.id] })
  await t.db
    .insert(groupRepos)
    .values({ groupId: group.id, url: 'git@git.corp:pay/pay.git', baseBranch: 'main' })
  await t.db
    .update(groupBots)
    .set({ workspaceState: 'ready', workspacePath: '/w/pay' })
    .where(eq(groupBots.groupId, group.id))
  const owners = client(t, await t.seed.cookie(owner.id))
  const members = client(t, await t.seed.cookie(member.id))
  const outsiders = client(t, await t.seed.cookie(outsider.id))
  const base = `/api/groups/${group.id}/bots/${bot.id}/git`
  const run = async (status: string, groupId = group.id, botId = bot.id) => {
    const [m] = await t.db
      .insert(messages)
      .values({ groupId, kind: 'user', authorUserId: owner.id, body: '@cc' })
      .returning()
    await t.db
      .insert(runs)
      .values({ groupId, botId, triggerMessageId: m!.id, originUserId: owner.id, status })
  }
  return { owner, member, outsider, machine, token, bot, group, owners, members, outsiders, base, run }
}

const ops = (w: Awaited<ReturnType<typeof world>>) =>
  w.members.get<GitOperationsDto>(`/api/groups/${w.group.id}/git/operations`)

describe('git reads', () => {
  it('relays refs, log, tree, text and compare to members', async () => {
    const w = await world()
    const d = await daemon(w.token)

    const refs = w.members.get<GitRefsDto>(`${w.base}/refs`)
    const r1 = await d.next('git.refs')
    expect(r1).toMatchObject({
      groupId: w.group.id,
      botId: w.bot.id,
      workspace: { repo: { url: 'git@git.corp:pay/pay.git', branch: 'main' }, cdPath: null },
    })
    const branch = {
      name: 'main',
      kind: 'local',
      current: true,
      upstream: 'origin/main',
      ahead: 0,
      behind: 1,
      commit: 'abc',
      subject: 's',
      at: '2026-10-20T00:00:00Z',
    }
    const remotes = [{ name: 'origin', url: 'git@git.corp:pay/pay.git' }]
    d.send({ t: 'git.refs.result', requestId: r1.requestId, branches: [branch], remotes, error: null })
    expect(await refs).toEqual({ status: 200, body: { branches: [branch], remotes } })

    const log = w.members.get<GitLogDto>(`${w.base}/log?ref=feat%2Fx&skip=50`)
    const r2 = await d.next('git.log')
    expect(r2).toMatchObject({ ref: 'feat/x', skip: 50, limit: 50 })
    d.send({ t: 'git.log.result', requestId: r2.requestId, commits: [], hasMore: true, error: null })
    expect((await log).body).toEqual({ commits: [], hasMore: true })

    const tree = w.members.get<FilesTreeDto>(`${w.base}/tree?ref=main&path=%2Fsrc%2F`)
    const r3 = await d.next('git.tree')
    expect(r3).toMatchObject({ ref: 'main', path: 'src' })
    d.send({ t: 'git.tree.result', requestId: r3.requestId, entries: [], truncated: false, error: null })
    expect((await tree).body).toEqual({ path: 'src', entries: [], truncated: false })

    const text = w.members.get<FileTextDto>(`${w.base}/text?ref=main&path=a.txt`)
    const r4 = await d.next('git.read')
    expect(r4).toMatchObject({ ref: 'main', path: 'a.txt' })
    d.send({
      t: 'git.read.result',
      requestId: r4.requestId,
      size: 2,
      binary: false,
      mime: 'text/plain',
      text: 'hi',
      error: null,
    })
    expect((await text).body).toEqual({
      path: 'a.txt',
      size: 2,
      binary: false,
      mime: 'text/plain',
      text: 'hi',
    })

    const cmp = w.members.get<GitCompareDto>(`${w.base}/compare?from=main`)
    const r5 = await d.next('git.compare')
    expect(r5).toMatchObject({ from: 'main', to: null })
    const changes = [{ path: 'a.txt', change: 'modified', oldPath: null }]
    d.send({ t: 'git.compare.result', requestId: r5.requestId, changes, error: null })
    expect((await cmp).body).toEqual({ changes })

    const bad = w.members.get(`${w.base}/log`)
    const r6 = await d.next('git.log')
    expect(r6.ref).toBeNull()
    d.send({ t: 'git.log.result', requestId: r6.requestId, commits: [], hasMore: false, error: 'bad ref' })
    expect(await bad).toMatchObject({ status: 409, body: { message: 'bad ref' } })
  })

  it('refuses outsiders, groups without a repo or not in partition mode, and offline bots', async () => {
    const w = await world()
    expect((await w.outsiders.get(`${w.base}/refs`)).status).toBe(404)
    expect((await w.members.get(`${w.base}/refs`)).status).toBe(409)

    await t.db.update(groups).set({ mode: 'force' }).where(eq(groups.id, w.group.id))
    const force = await w.members.get(`${w.base}/refs`)
    expect(force).toMatchObject({
      status: 409,
      body: { message: '仅绑定了仓库的分区模式群可以使用 Git 操作' },
    })
    await t.db.update(groups).set({ mode: 'partition' }).where(eq(groups.id, w.group.id))
    await t.db.delete(groupRepos).where(eq(groupRepos.groupId, w.group.id))
    expect((await w.members.get(`${w.base}/refs`)).status).toBe(409)
    expect((await w.owners.post(`${w.base}/actions`, { action: 'pull' })).status).toBe(409)
  })
})

describe('git actions', () => {
  it("runs the owner's commit at once with the bot's identity, and records the outcome", async () => {
    const w = await world()
    const d = await daemon(w.token)
    const got = events(t, w.member.id)
    const res = w.owners.post<GitOperationDto>(`${w.base}/actions`, { action: 'commit', message: '修复退款' })
    const req = await d.act({ output: 'pushed with ghp_abcdefghijklmnopqrstuvwxyz0123456789AB' })
    expect(req).toMatchObject({
      action: 'commit',
      message: '修复退款',
      branch: null,
      remote: null,
      identity: { name: 'cc', email: `${w.bot.id.slice(0, 8)}@bots.gonggong.local` },
    })
    const op = await res
    expect(op.status).toBe(200)
    expect(op.body).toMatchObject({
      action: 'commit',
      status: 'succeeded',
      requestedBy: { id: w.owner.id, name: '王磊' },
      decidedBy: null,
      error: null,
      finishedAt: clock.toISOString(),
    })
    expect(op.body.output).toBe(`pushed with ${MASK}`)
    expect(
      got
        .filter((e) => e.t === 'group.gitOperation')
        .map((e) => (e as { operation: GitOperationDto }).operation.status),
    ).toEqual(['running', 'succeeded'])
    const logs = await t.db.select().from(auditLogs)
    expect(logs.map((l) => l.action)).toEqual(['git.run'])
    expect(logs[0]).toMatchObject({ category: 'admin', actorUserId: w.owner.id, groupId: w.group.id })
    expect(JSON.stringify(logs[0]!.detail)).not.toContain('ghp_')

    const fail = w.owners.post<GitOperationDto>(`${w.base}/actions`, { action: 'pull' })
    await d.act({ ok: false, output: null, error: 'not a fast-forward' })
    expect((await fail).body).toMatchObject({ status: 'failed', error: 'not a fast-forward' })
    expect((await ops(w)).body.operations.map((o) => o.status)).toEqual(['failed', 'succeeded'])
  })

  it("fails the owner's action when the machine is offline", async () => {
    const w = await world()
    const res = await w.owners.post<GitOperationDto>(`${w.base}/actions`, { action: 'pull' })
    expect(res.body).toMatchObject({ status: 'failed', error: 'cc 离线，无法执行 Git 操作' })
  })

  it('queues a member request for the owner, who approves it to run', async () => {
    const w = await world()
    const got = events(t, w.member.id)
    const res = await w.members.post<GitOperationDto>(`${w.base}/actions`, {
      action: 'checkout',
      branch: 'feat/x',
    })
    expect(res.body).toMatchObject({
      status: 'pending_approval',
      branch: 'feat/x',
      requestedBy: { id: w.member.id, name: '陈晨' },
      expiresAt: new Date(clock.getTime() + 30 * 60_000).toISOString(),
    })
    expect(got.some((e) => e.t === 'group.gitOperation')).toBe(true)
    const [note] = await t.db.select().from(notifications).where(eq(notifications.userId, w.owner.id))
    expect(note).toMatchObject({
      type: 'git_operation_request',
      payload: {
        groupId: w.group.id,
        botId: w.bot.id,
        botName: 'cc',
        byName: '陈晨',
        operationId: res.body.id,
        summary: 'checkout feat/x',
      },
    })
    const decide = `/api/git-operations/${res.body.id}/decide`
    expect((await w.members.post(decide, { approve: true })).status).toBe(403)

    const d = await daemon(w.token)
    const approved = w.owners.post<GitOperationDto>(decide, { approve: true })
    expect(await d.act()).toMatchObject({ action: 'checkout', branch: 'feat/x' })
    expect((await approved).body).toMatchObject({
      status: 'succeeded',
      decidedBy: { id: w.owner.id, name: '王磊' },
    })
    const [after] = await t.db.select().from(notifications).where(eq(notifications.userId, w.owner.id))
    expect(after!.resolvedAt).not.toBeNull()
    expect((await w.owners.post(decide, { approve: true })).status).toBe(409)
    const actions = (await t.db.select().from(auditLogs)).map((l) => l.action)
    expect(actions).toEqual(['git.request', 'git.decide', 'git.run'])
  })

  it('rejects and expires member requests', async () => {
    const w = await world()
    const a = await w.members.post<GitOperationDto>(`${w.base}/actions`, { action: 'pull' })
    const rejected = await w.owners.post<GitOperationDto>(`/api/git-operations/${a.body.id}/decide`, {
      approve: false,
    })
    expect(rejected.body).toMatchObject({ status: 'rejected', decidedBy: { id: w.owner.id } })

    const b = await w.members.post<GitOperationDto>(`${w.base}/actions`, { action: 'pull' })
    clock = new Date(clock.getTime() + 31 * 60_000)
    expect((await w.owners.post(`/api/git-operations/${b.body.id}/decide`, { approve: true })).status).toBe(
      409,
    )
    await expireGitOperations(t.ctx)
    const list = (await ops(w)).body.operations
    expect(list.find((o) => o.id === b.body.id)?.status).toBe('expired')
    const notes = await t.db.select().from(notifications).where(eq(notifications.userId, w.owner.id))
    expect(notes.every((n) => n.resolvedAt)).toBe(true)
  })

  it('refuses while the bot, or a bot sharing its directory, has a live run', async () => {
    const w = await world()
    await daemon(w.token)
    const busy = { message: 'cc 正在运行，等运行结束后再操作' }
    await w.run('running')
    expect(await w.owners.post(`${w.base}/actions`, { action: 'pull' })).toMatchObject({
      status: 409,
      body: busy,
    })
    await t.db.update(runs).set({ status: 'succeeded' })

    const twin = await t.seed.bot({ ownerId: w.owner.id, name: 'twin', machineId: w.machine.id })
    const other = await t.seed.group({ createdBy: w.owner.id, botIds: [twin.id] })
    await t.db.update(groupBots).set({ workspacePath: '/w/pay' }).where(eq(groupBots.groupId, other.id))
    await w.run('awaiting_approval', other.id, twin.id)
    expect((await w.owners.post(`${w.base}/actions`, { action: 'pull' })).status).toBe(409)

    const pending = await w.members.post<GitOperationDto>(`${w.base}/actions`, { action: 'pull' })
    expect(pending.body.status).toBe('pending_approval')
    const decided = await w.owners.post(`/api/git-operations/${pending.body.id}/decide`, { approve: true })
    expect(decided).toMatchObject({ status: 409, body: busy })
    expect((await ops(w)).body.operations[0]?.status).toBe('pending_approval')
  })

  it('maps a busy daemon to 409 and records the failure', async () => {
    const w = await world()
    const d = await daemon(w.token)
    const res = w.owners.post(`${w.base}/actions`, { action: 'pull' })
    await d.act({ ok: false, busy: true, output: null })
    expect(await res).toMatchObject({ status: 409, body: { message: 'cc 正在运行，等运行结束后再操作' } })
    expect((await ops(w)).body.operations[0]?.status).toBe('failed')
  })

  it('asks the owner to confirm pushing the protected base branch; approving a member request confirms it', async () => {
    const w = await world()
    await t.db.update(groups).set({ protectBase: true }).where(eq(groups.id, w.group.id))
    const d = await daemon(w.token)
    const push = { action: 'push', branch: 'main' }
    expect(await w.owners.post(`${w.base}/actions`, push)).toMatchObject({
      status: 409,
      body: { message: '推送基准分支需要再次确认' },
    })
    const confirmed = w.owners.post<GitOperationDto>(`${w.base}/actions`, { ...push, confirmBase: true })
    expect(await d.act()).toMatchObject({ action: 'push', branch: 'main', remote: 'origin', identity: null })
    expect((await confirmed).body).toMatchObject({ status: 'succeeded', pushesBase: true })

    const feature = w.owners.post<GitOperationDto>(`${w.base}/actions`, { action: 'push', branch: 'feat/x' })
    await d.act()
    expect((await feature).body).toMatchObject({ status: 'succeeded', pushesBase: false })

    const asked = await w.members.post<GitOperationDto>(`${w.base}/actions`, push)
    expect(asked.body).toMatchObject({ status: 'pending_approval', pushesBase: true })
    const approved = w.owners.post<GitOperationDto>(`/api/git-operations/${asked.body.id}/decide`, {
      approve: true,
    })
    await d.act()
    expect((await approved).body.status).toBe('succeeded')
  })

  it('lists pending operations plus the latest 20 settled ones, newest first', async () => {
    const w = await world()
    const pending = await w.members.post<GitOperationDto>(`${w.base}/actions`, { action: 'pull' })
    for (let i = 0; i < 22; i++) {
      clock = new Date(clock.getTime() + 1000)
      await w.owners.post(`${w.base}/actions`, { action: 'pull' })
    }
    const list = (await ops(w)).body.operations
    expect(list).toHaveLength(21)
    expect(list.at(-1)?.id).toBe(pending.body.id)
    expect(list[0]!.createdAt > list[1]!.createdAt).toBe(true)
    expect((await w.outsiders.get(`/api/groups/${w.group.id}/git/operations`)).status).toBe(404)
  })
})
