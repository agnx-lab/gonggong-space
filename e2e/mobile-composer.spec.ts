import { expect, test } from '@playwright/test'
import { buildDaemon, memberWithMachine } from './helpers'

test.beforeAll(buildDaemon)
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

test('on a phone the composer draws its @ highlight with the same font as the text being typed', async ({
  page,
}) => {
  const { api } = await memberWithMachine(page, 'mobile1')
  const name = 'mobile1 Claude'
  const bot = await api.call<{ id: string }>('post', '/api/bots', {
    name,
    ownerId: (await api.me()).id,
    agentKind: 'claude',
    avatar: 'role-no',
    machineId: await api.machineId(),
    systemPrompt: '',
  })
  const group = await api.call<{ id: string }>('post', '/api/groups', {
    name: 'mobile1',
    kind: 'group',
    botIds: [bot.id],
    repo: null,
  })
  await page.goto(`/g/${group.id}`)
  const input = page.getByPlaceholder('发消息，@ 触发 Bot')
  await input.fill(`@${name} 帮我看看这个问题`)
  const mirror = page.locator('.pn-composer__mirror')
  await expect(mirror).toContainText(name)
  await input.press('End')
  await page
    .locator('.pn-composer')
    .screenshot({ path: test.info().outputPath('composer.png'), caret: 'initial' })
  const font = (el: Element) => getComputedStyle(el).fontSize
  expect(await input.evaluate(font)).toBe('16px')
  expect(await mirror.evaluate(font)).toBe('16px')
  // Same font: the transparent text the caret follows lies right on the drawn one.
  expect(await mirror.evaluate((el) => el.scrollHeight)).toBe(await input.evaluate((el) => el.scrollHeight))
})
