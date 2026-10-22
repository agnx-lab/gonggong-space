import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { bindManaged, buildDaemon, memberWithMachine, ROOT } from './helpers'

test.beforeAll(buildDaemon)

const composer = '输入消息，@ 触发 Bot 或引用文件，/ 查看命令'
// Scripted agent: `mock:tool <name> <json>` calls the built-in gonggong tool; no model.
const MOCK = `node ${join(ROOT, 'tools/mock-agent/agent.js')}`

test('a bot pins a link to the group tab bar, a member adds a shortcut; both open in place', async ({
  page,
}) => {
  test.setTimeout(3 * 60_000)
  const { m, api } = await memberWithMachine(page, 'gt1', { env: { GONGGONG_ADAPTER_CMD: MOCK } })
  const me = await api.me()
  const bot = await api.call<{ id: string }>('post', '/api/bots', {
    name: 'gt1 Bot',
    ownerId: me.id,
    agentKind: 'claude',
    machineId: await api.machineId(),
    systemPrompt: '',
  })
  m.start()
  try {
    const group = await api.call<{ id: string }>('post', '/api/groups', {
      name: '标签',
      kind: 'group',
      botIds: [bot.id],
      repo: null,
    })
    await bindManaged(page.request, group.id, [bot.id])
    await page.goto(`/g/${group.id}`)
    const main = page.getByRole('main')
    const bar = main.getByRole('navigation', { name: '群标签栏' })

    const link = { kind: 'link', url: 'https://example.com/', title: '接口文档' }
    await page.getByPlaceholder(composer).fill(`@gt1 Bot mock:tool tab_create ${JSON.stringify(link)}`)
    await page.getByRole('button', { name: '发送' }).click()
    const docs = bar.getByTestId('group-tab').filter({ hasText: '接口文档' })
    await expect(docs).toBeVisible({ timeout: 60_000 })
    await expect(main.getByText('gt1 Bot 添加了标签：接口文档')).toBeVisible()
    await docs.click()
    await expect(page.locator('iframe[title="接口文档"]')).toHaveAttribute('src', 'https://example.com/')

    await bar.getByRole('button', { name: '添加标签' }).click()
    const dialog = page.getByRole('dialog', { name: '添加标签' })
    await dialog.getByRole('radio', { name: '入口' }).click()
    await dialog.getByRole('button', { name: '添加' }).click()
    const notice = bar.getByTestId('group-tab').filter({ hasText: '群公告' })
    await expect(notice).toBeVisible()
    await notice.click()
    await expect(page.getByRole('complementary', { name: '群设置' })).toBeVisible()

    // Shared and persisted: a reload shows the same bar.
    await page.reload()
    await expect(bar.getByTestId('group-tab')).toHaveText(['接口文档', '群公告'])
  } finally {
    m.stop()
  }
})
