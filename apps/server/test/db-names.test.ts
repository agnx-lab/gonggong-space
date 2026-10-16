import { describe, expect, it } from 'vitest'
import { staleTestDbs, testDbName } from './support/db-names.js'

describe('test database names', () => {
  const now = Date.UTC(2026, 9, 16, 10)
  const hour = 3_600_000

  it('carry their creation time', () => {
    expect(testDbName('t', now)).toMatch(new RegExp(`^gonggong_t_${now}_[0-9a-f]{8}$`))
    expect(testDbName('tpl', now)).toMatch(new RegExp(`^gonggong_tpl_${now}_[0-9a-f]{8}$`))
  })

  it('are stale only when a test run left them over an hour ago', () => {
    const old = [testDbName('t', now - hour - 1), testDbName('tpl', now - 2 * hour)]
    const live = [testDbName('t', now - 1000), testDbName('tpl', now)]
    expect(staleTestDbs([...old, ...live, 'gonggong', 'gonggong_test', 'gonggong_e2e'], now)).toEqual(old)
  })
})
