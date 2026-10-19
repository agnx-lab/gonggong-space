import {
  type GroupKnowledgeDto,
  KNOWLEDGE_MAX_ENTRIES,
  type KnowledgeDetailDto,
  type KnowledgeVersionDto,
} from '@gonggong/protocol'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { groupKnowledge, messages } from '../src/db/schema.js'
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
  const group = await t.seed.group({ createdBy: wang.id, memberIds: [li.id] })
  return {
    wang,
    li,
    group,
    admin: client(t, await t.seed.cookie(wang.id)),
    member: client(t, await t.seed.cookie(li.id)),
    stranger: client(t, await t.seed.cookie(outsider.id)),
  }
}

const eventBodies = async (groupId: string) =>
  (
    await t.db
      .select({ body: messages.body })
      .from(messages)
      .where(and(eq(messages.groupId, groupId), eq(messages.kind, 'event')))
      .orderBy(messages.seq)
  ).map((m) => m.body)

describe('group knowledge base', () => {
  it('members create, list, read and search entries; pinned ones come first', async () => {
    const w = await world()
    const seen = events(t, w.li.id)
    const deploy = await w.member.post<KnowledgeDetailDto>(`/api/groups/${w.group.id}/knowledge`, {
      title: '部署流程',
      body: '先跑 pnpm check，再推 gitlab 由 Jenkins 构建',
      tags: ['部署'],
    })
    expect(deploy.status).toBe(200)
    expect(deploy.body).toMatchObject({
      title: '部署流程',
      body: '先跑 pnpm check，再推 gitlab 由 Jenkins 构建',
      tags: ['部署'],
      pinned: false,
      version: 1,
      updatedBy: { kind: 'user', id: w.li.id, name: '李建国' },
    })
    expect(seen).toContainEqual({ t: 'group.knowledge', groupId: w.group.id, entryId: deploy.body.id })
    const rules = await w.admin.post<KnowledgeDetailDto>(`/api/groups/${w.group.id}/knowledge`, {
      title: '代码约定',
      body: 'x'.repeat(300),
      pinned: true,
    })
    expect(rules.body.pinned).toBe(true)

    const list = await w.member.get<GroupKnowledgeDto>(`/api/groups/${w.group.id}/knowledge`)
    expect(list.body.canManage).toBe(false)
    expect(list.body.entries.map((e) => e.title)).toEqual(['代码约定', '部署流程'])
    expect(list.body.entries[0]!.excerpt).toBe('x'.repeat(200))
    expect((await w.admin.get<GroupKnowledgeDto>(`/api/groups/${w.group.id}/knowledge`)).body.canManage).toBe(
      true,
    )

    const hit = await w.member.get<GroupKnowledgeDto>(
      `/api/groups/${w.group.id}/knowledge?q=${encodeURIComponent('jenkins')}`,
    )
    expect(hit.body.entries.map((e) => e.title)).toEqual(['部署流程'])
    const byTag = await w.member.get<GroupKnowledgeDto>(
      `/api/groups/${w.group.id}/knowledge?q=${encodeURIComponent('部署')}`,
    )
    expect(byTag.body.entries.map((e) => e.title)).toEqual(['部署流程'])

    const detail = await w.member.get<KnowledgeDetailDto>(`/api/knowledge/${deploy.body.id}`)
    expect(detail.body.body).toContain('Jenkins')
    expect(await eventBodies(w.group.id)).toEqual([
      '李建国 新建了知识库条目「部署流程」',
      '王磊 新建了知识库条目「代码约定」',
    ])
  })

  it('keeps non-members out and pinning and deleting to group admins', async () => {
    const w = await world()
    const url = `/api/groups/${w.group.id}/knowledge`
    expect((await w.stranger.get(url)).status).toBe(404)
    expect((await w.stranger.post(url, { title: 'a', body: 'b' })).status).toBe(404)
    expect((await w.member.post(url, { title: 'a', body: 'b', pinned: true })).status).toBe(403)
    const e = await w.member.post<KnowledgeDetailDto>(url, { title: 'a', body: 'b' })
    expect((await w.stranger.get(`/api/knowledge/${e.body.id}`)).status).toBe(404)
    expect(
      (await w.member.patch(`/api/knowledge/${e.body.id}`, { baseVersion: 1, pinned: true })).status,
    ).toBe(403)
    expect((await w.member.del(`/api/knowledge/${e.body.id}`)).status).toBe(403)

    const pinned = await w.admin.patch<KnowledgeDetailDto>(`/api/knowledge/${e.body.id}`, {
      baseVersion: 1,
      pinned: true,
    })
    expect(pinned.body).toMatchObject({ pinned: true, version: 1 })
    expect((await w.admin.del(`/api/knowledge/${e.body.id}`)).status).toBe(204)
    expect((await w.member.get(`/api/knowledge/${e.body.id}`)).status).toBe(404)
    expect((await w.member.get<GroupKnowledgeDto>(url)).body.entries).toEqual([])
    expect(await eventBodies(w.group.id)).toEqual([
      '李建国 新建了知识库条目「a」',
      '王磊 置顶了知识库条目「a」',
      '王磊 删除了知识库条目「a」',
    ])
  })

  it('updates with optimistic concurrency, keeps every version and rolls back', async () => {
    const w = await world()
    const e = await w.member.post<KnowledgeDetailDto>(`/api/groups/${w.group.id}/knowledge`, {
      title: '账号',
      body: 'v1 正文',
    })
    const url = `/api/knowledge/${e.body.id}`
    const v2 = await w.admin.patch<KnowledgeDetailDto>(url, {
      baseVersion: 1,
      body: 'v2 正文',
      tags: ['账号'],
    })
    expect(v2.body).toMatchObject({ version: 2, body: 'v2 正文', tags: ['账号'], title: '账号' })
    const stale = await w.member.patch<{ error: string; message: string }>(url, {
      baseVersion: 1,
      body: '覆盖',
    })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ error: 'conflict', message: '条目已被他人修改，请刷新后再改' })
    const pinned = await w.admin.patch<KnowledgeDetailDto>(url, { baseVersion: 1, pinned: true })
    expect(pinned.body).toMatchObject({ pinned: true, version: 2, updatedBy: { name: '王磊' } })

    const back = await w.member.post<KnowledgeDetailDto>(`${url}/rollback`, { version: 1 })
    expect(back.body).toMatchObject({ version: 3, body: 'v1 正文', tags: [] })
    expect((await w.member.post(`${url}/rollback`, { version: 9 })).status).toBe(404)

    const versions = await w.member.get<KnowledgeVersionDto[]>(`${url}/versions`)
    expect(versions.body.map((v) => [v.version, v.action, v.body, v.by?.name, v.current])).toEqual([
      [3, 'rollback', 'v1 正文', '李建国', true],
      [2, 'update', 'v2 正文', '王磊', false],
      [1, 'create', 'v1 正文', '李建国', false],
    ])
    expect(await eventBodies(w.group.id)).toEqual([
      '李建国 新建了知识库条目「账号」',
      '王磊 更新了知识库条目「账号」',
      '王磊 置顶了知识库条目「账号」',
      '李建国 将知识库条目「账号」回滚到 v1',
    ])
  })

  it('caps the live entries of a group', async () => {
    const w = await world()
    await t.db.insert(groupKnowledge).values(
      Array.from({ length: KNOWLEDGE_MAX_ENTRIES }, (_, i) => ({
        groupId: w.group.id,
        title: `t${i}`,
        body: '',
        archivedAt: i === 0 ? new Date() : null,
      })),
    )
    const url = `/api/groups/${w.group.id}/knowledge`
    expect((await w.member.post(url, { title: 'a', body: '' })).status).toBe(200)
    const full = await w.member.post<{ message: string }>(url, { title: 'b', body: '' })
    expect(full.status).toBe(400)
    expect(full.body.message).toBe(`每个群最多 ${KNOWLEDGE_MAX_ENTRIES} 条知识库条目`)
  })
})
