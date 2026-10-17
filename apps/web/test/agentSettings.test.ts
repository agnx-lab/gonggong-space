import { fieldsFor } from '@gonggong/protocol'
import { describe, expect, it } from 'vitest'
import {
  boolState,
  fieldTexts,
  joinProviderEnv,
  msLabel,
  parseMs,
  parseTokens,
  providerSummary,
  splitEnv,
  tokensLabel,
  toValues,
} from '../src/features/machines/agentSettings'

const PROVIDER = fieldsFor('claude', 'provider')
const AGENT = fieldsFor('claude', 'agent')
const field = (id: string) => {
  const f = [...PROVIDER, ...AGENT].find((x) => x.id === id)
  if (!f) throw new Error(id)
  return f
}

describe('units', () => {
  it('parses token counts with k / m, matching the listed windows by their label', () => {
    const ctx = field('contextWindow')
    expect(parseTokens('262144', ctx)).toBe(262144)
    expect(parseTokens('256k', ctx)).toBe(262144)
    expect(parseTokens('256K', ctx)).toBe(262144)
    expect(parseTokens('1m', ctx)).toBe(1000000)
    expect(parseTokens('300k', ctx)).toBe(300000)
    expect(parseTokens('1,000,000', ctx)).toBe(1000000)
    expect(parseTokens('1.5m', ctx)).toBe(1500000)
    expect(parseTokens('abc', ctx)).toBeNull()
    expect(parseTokens('0', ctx)).toBeNull()
    expect(parseTokens('-5', ctx)).toBeNull()
  })

  it('formats tokens as K / M', () => {
    expect(tokensLabel(262144)).toBe('256K')
    expect(tokensLabel(200000)).toBe('200K')
    expect(tokensLabel(1000000)).toBe('1M')
    expect(tokensLabel(128000)).toBe('128K')
    expect(tokensLabel(12345)).toBe('12345')
  })

  it('parses and formats durations in ms', () => {
    expect(parseMs('600000')).toBe(600000)
    expect(parseMs('600s')).toBe(600000)
    expect(parseMs('10m')).toBe(600000)
    expect(parseMs('10min')).toBe(600000)
    expect(parseMs('1h')).toBe(3600000)
    expect(parseMs('1500ms')).toBe(1500)
    expect(parseMs('x')).toBeNull()
    expect(msLabel(3000000)).toBe('50m')
    expect(msLabel(3600000)).toBe('1h')
    expect(msLabel(90000)).toBe('90s')
    expect(msLabel(1500)).toBe('1500ms')
  })

  it('reads a bool as default / on / off', () => {
    expect(boolState('')).toBe('default')
    expect(boolState('true')).toBe('on')
    expect(boolState('1')).toBe('on')
    expect(boolState('false')).toBe('off')
    expect(boolState('0')).toBe('off')
  })
})

describe('provider env', () => {
  it('splits known fields from the rest, keeping unknown variables', () => {
    const { values, other } = splitEnv(
      { CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144', ENABLE_TOOL_SEARCH: 'false', GITHUB_TOKEN: '****wxyz' },
      PROVIDER,
    )
    expect(values).toEqual({ contextWindow: '262144', toolSearch: 'false' })
    expect(other).toEqual({ GITHUB_TOKEN: '****wxyz' })
  })

  it('writes untouched values back as they were', () => {
    const env = { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '204800', API_TIMEOUT_MS: 'weird', X: '1' }
    const initial = splitEnv(env, PROVIDER).values
    const texts = fieldTexts(PROVIDER, initial)
    expect(joinProviderEnv({ fields: PROVIDER, texts, initial, other: 'X=1' })).toEqual(env)
  })

  it('leaves empty values out, converts units and the three-state bool', () => {
    const texts = {
      ...fieldTexts(PROVIDER, {}),
      contextWindow: '256K',
      maxOutputTokens: '128k',
      apiTimeout: '10m',
      toolSearch: 'false',
      disableThinking: '1',
    }
    expect(joinProviderEnv({ fields: PROVIDER, texts, initial: {}, other: '' })).toEqual({
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144',
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: '128000',
      API_TIMEOUT_MS: '600000',
      ENABLE_TOOL_SEARCH: 'false',
      CLAUDE_CODE_DISABLE_THINKING: '1',
    })
  })

  it('refuses a known variable among the others, pointing at its control', () => {
    expect(() =>
      joinProviderEnv({
        fields: PROVIDER,
        texts: fieldTexts(PROVIDER, {}),
        initial: {},
        other: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS=1000',
      }),
    ).toThrow('请在上方「输出上限」设置')
  })

  it('refuses a bad number and an auto-compact window out of range or above the window', () => {
    const base = { fields: PROVIDER, initial: {}, other: '' }
    const texts = fieldTexts(PROVIDER, {})
    expect(() => joinProviderEnv({ ...base, texts: { ...texts, maxOutputTokens: 'lots' } })).toThrow(
      '「输出上限」',
    )
    expect(() => joinProviderEnv({ ...base, texts: { ...texts, autoCompactWindow: '50k' } })).toThrow(
      '100000',
    )
    expect(() =>
      joinProviderEnv({ ...base, texts: { ...texts, contextWindow: '200K', autoCompactWindow: '256k' } }),
    ).toThrow('不能大于上下文窗口')
    expect(() =>
      joinProviderEnv({ ...base, texts: { ...texts, autoCompactWindow: '300k' }, modelWindow: 262144 }),
    ).toThrow('不能大于上下文窗口')
    expect(
      joinProviderEnv({ ...base, texts: { ...texts, autoCompactWindow: '180k' }, modelWindow: 262144 }),
    ).toEqual({ CLAUDE_CODE_AUTO_COMPACT_WINDOW: '180000' })
  })

  it('summarises window and output for the provider list', () => {
    expect(
      providerSummary({ CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144', CLAUDE_CODE_MAX_OUTPUT_TOKENS: '128000' }),
    ).toBe('上下文 256K · 输出 128K')
    expect(providerSummary({ X: '1' })).toBe('')
  })
})

describe('agent values', () => {
  it('turns texts into values, durations parsed, untouched kept, empty left out', () => {
    const initial = { bashTimeout: '120000', language: 'chinese' }
    const texts = { ...fieldTexts(AGENT, initial), bashMaxTimeout: '10m', language: '' }
    expect(toValues(AGENT, texts, initial)).toEqual({ bashTimeout: '120000', bashMaxTimeout: '600000' })
  })
})
