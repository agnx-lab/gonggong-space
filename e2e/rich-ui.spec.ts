import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { bindManaged, buildDaemon, memberWithMachine, ROOT } from './helpers'

test.beforeAll(buildDaemon)

// Scripted agent: `mock:say <text>` replies with the text verbatim.
const MOCK = `${process.execPath} ${join(ROOT, 'tools/mock-agent/agent.js')}`

const REPLY = [
  'CPU 持续升高，建议扩容。',
  '',
  '```metrics',
  '[{"label":"当前 CPU","value":78,"unit":"%","delta":36,"tone":"bad"}]',
  '```',
  '',
  '```chart',
  '{"type":"line","title":"CPU 使用率","x":["10:00","11:00","12:00"],"series":[{"name":"CPU","data":[42,61,78]}],"unit":"%"}',
  '```',
  '',
  '```actions',
  '{"id":"scale","prompt":"要扩容吗？","options":[{"label":"扩容到 4 台","value":"scale-4","style":"primary"},{"label":"再观察"}]}',
  '```',
].join('\n')

test('a bot reply renders metrics, a chart and buttons; a click answers the bot as the clicker', async ({
  page,
}) => {
  test.setTimeout(4 * 60_000)
  const tag = Date.now().toString(36)
  const { m, api } = await memberWithMachine(page, `rich${tag}`, { env: { GONGGONG_ADAPTER_CMD: MOCK } })
  const me = await api.me()
  const botName = `图表 ${tag}`
  const bot = await api.call<{ id: string }>('post', '/api/bots', {
    name: botName,
    ownerId: me.id,
    agentKind: 'claude',
    avatar: 'role-no',
    machineId: await api.machineId(),
    systemPrompt: '',
  })
  m.start()
  try {
    const group = await api.call<{ id: string }>('post', '/api/groups', {
      name: '富交互',
      kind: 'group',
      botIds: [bot.id],
      repo: null,
    })
    await bindManaged(page.request, group.id, [bot.id])
    await page.goto(`/g/${group.id}`)
    await api.call('post', `/api/groups/${group.id}/messages`, {
      body: `@${botName} mock:say ${REPLY}`,
      clientId: `rich-${tag}`,
    })
    const runs = page.getByTestId('run-card')
    await expect(runs).toHaveCount(1, { timeout: 60_000 })
    await expect(runs.first()).toHaveAttribute('data-status', 'completed', { timeout: 60_000 })

    const main = page.getByRole('main')
    await expect(main.locator('.rich-metric__value').first()).toContainText('78')
    const chart = main.getByRole('img', { name: 'CPU 使用率' })
    await expect(chart).toBeVisible()
    await expect(chart.locator('canvas, svg').first()).toBeVisible({ timeout: 30_000 })

    await main.getByRole('button', { name: '扩容到 4 台' }).click()
    await expect(main.getByText(`rich${tag} 已选择 扩容到 4 台`)).toBeVisible({ timeout: 30_000 })
    await expect(main.getByRole('button', { name: '扩容到 4 台' })).toBeDisabled()
    // The click comes back to the bot as a message from the clicker, starting its next turn.
    await expect(main.getByText(`@${botName} 选择了「scale-4」`)).toBeVisible()
    await expect(runs).toHaveCount(2, { timeout: 60_000 })
  } finally {
    m.stop()
  }
})
