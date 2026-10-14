import { expect, test } from '@playwright/test'
import { bindManaged, buildDaemon, memberWithMachine } from './helpers'

test.beforeAll(buildDaemon)

const composer = '输入消息，@ 触发 Bot 或引用文件，/ 查看命令'

test('hovering a bot in the timeline shows its card, whose @TA puts the bot into the composer', async ({
  page,
}) => {
  const { m, api } = await memberWithMachine(page, 'mention1')
  try {
    const me = await api.me()
    const name = 'mention1 Claude'
    const bot = await api.call<{ id: string }>('post', '/api/bots', {
      name,
      ownerId: me.id,
      agentKind: 'claude',
      avatar: 'role-no',
      machineId: await api.machineId(),
      systemPrompt: '',
    })
    const group = await api.call<{ id: string }>('post', '/api/groups', {
      name: 'mention1',
      kind: 'group',
      botIds: [bot.id],
      repo: null,
    })
    m.start()
    await bindManaged(page.request, group.id, [bot.id])
    await page.goto(`/g/${group.id}`)
    await page.getByPlaceholder(composer).fill(`@${name} 你好`)
    await page.getByRole('button', { name: '发送' }).click()
    const card = page.getByTestId('run-card').last()
    await card.locator('.user-card-trigger', { hasText: name }).hover()
    const dialog = page.getByRole('dialog', { name: 'Bot 名片' })
    await expect(dialog).toContainText('mention1')
    await expect(dialog).toContainText('Claude Code')

    await page.getByPlaceholder(composer).fill('请')
    await dialog.getByRole('button', { name: '@TA' }).click()
    await expect(page.getByPlaceholder(composer)).toHaveValue(`请 @${name} `)
    await expect(page.getByPlaceholder(composer)).toBeFocused()
    await expect(dialog).toBeHidden()
  } finally {
    m.stop()
  }
})
