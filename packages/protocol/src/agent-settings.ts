import { z } from 'zod'
import type { AgentKind } from './common.js'

/**
 * Agent settings the UI offers as controls instead of raw variables (design §4.2.2). `provider` fields live in a
 * provider's (or the official login's) `env`; `agent` fields are the machine default per agent kind, and the
 * `botOverride` ones may be overridden per bot. `target`: a Claude Code flag-settings top-level key or an env var.
 * Mirrored by `fixtures/agent-setting-fields.json` and `crates/gonggong/src/agent_settings.rs`.
 */
export interface AgentSettingField {
  id: string
  agent: AgentKind
  layer: 'provider' | 'agent'
  target: 'settings' | 'env'
  key: string
  /** tokens / ms: a positive integer; flag: '1' or absent; bool: 'true' | 'false' | absent; text: any string. */
  type: 'tokens' | 'ms' | 'flag' | 'bool' | 'text' | 'enum'
  options?: readonly string[]
  min?: number
  max?: number
  botOverride?: boolean
  /** Lowest Claude Code version honouring the key. */
  minVersion?: string
}

export const AGENT_SETTING_FIELDS = [
  {
    id: 'contextWindow',
    agent: 'claude',
    layer: 'provider',
    target: 'env',
    key: 'CLAUDE_CODE_MAX_CONTEXT_TOKENS',
    type: 'tokens',
    options: ['200000', '262144', '1000000'],
  },
  {
    id: 'autoCompactWindow',
    agent: 'claude',
    layer: 'provider',
    target: 'env',
    key: 'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
    type: 'tokens',
    min: 100000,
    max: 1000000,
  },
  {
    id: 'maxOutputTokens',
    agent: 'claude',
    layer: 'provider',
    target: 'env',
    key: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS',
    type: 'tokens',
  },
  {
    id: 'disableThinking',
    agent: 'claude',
    layer: 'provider',
    target: 'env',
    key: 'CLAUDE_CODE_DISABLE_THINKING',
    type: 'flag',
  },
  {
    id: 'disableBetas',
    agent: 'claude',
    layer: 'provider',
    target: 'env',
    key: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
    type: 'flag',
  },
  {
    id: 'toolSearch',
    agent: 'claude',
    layer: 'provider',
    target: 'env',
    key: 'ENABLE_TOOL_SEARCH',
    type: 'bool',
  },
  { id: 'apiTimeout', agent: 'claude', layer: 'provider', target: 'env', key: 'API_TIMEOUT_MS', type: 'ms' },
  {
    id: 'language',
    agent: 'claude',
    layer: 'agent',
    target: 'settings',
    key: 'language',
    type: 'text',
    botOverride: true,
  },
  {
    id: 'thinking',
    agent: 'claude',
    layer: 'agent',
    target: 'settings',
    key: 'alwaysThinkingEnabled',
    type: 'bool',
    botOverride: true,
  },
  {
    id: 'attribution',
    agent: 'claude',
    layer: 'agent',
    target: 'settings',
    key: 'attribution',
    type: 'enum',
    /** none: `{ commit: '', pr: '' }`. */
    options: ['none'],
    botOverride: true,
  },
  {
    id: 'gitInstructions',
    agent: 'claude',
    layer: 'agent',
    target: 'settings',
    key: 'includeGitInstructions',
    type: 'bool',
  },
  {
    id: 'autoMemory',
    agent: 'claude',
    layer: 'agent',
    target: 'settings',
    key: 'autoMemoryEnabled',
    type: 'bool',
  },
  {
    id: 'autoCompact',
    agent: 'claude',
    layer: 'agent',
    target: 'settings',
    key: 'autoCompactEnabled',
    type: 'bool',
  },
  {
    id: 'bashTimeout',
    agent: 'claude',
    layer: 'agent',
    target: 'env',
    key: 'BASH_DEFAULT_TIMEOUT_MS',
    type: 'ms',
  },
  {
    id: 'bashMaxTimeout',
    agent: 'claude',
    layer: 'agent',
    target: 'env',
    key: 'BASH_MAX_TIMEOUT_MS',
    type: 'ms',
  },
  {
    id: 'mcpIdleTimeout',
    agent: 'claude',
    layer: 'agent',
    target: 'env',
    key: 'CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT',
    type: 'ms',
  },
  {
    id: 'nonessentialTraffic',
    agent: 'claude',
    layer: 'agent',
    target: 'env',
    key: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    type: 'flag',
  },
] as const satisfies readonly AgentSettingField[]

export type AgentSettingId = (typeof AGENT_SETTING_FIELDS)[number]['id']

/** Claude Code settings gonggong owns (permission tier, model, MCP, skills, key): shown as 由共工管理, never set. */
export const LOCKED_CLAUDE_SETTINGS = [
  'permissions',
  'model',
  'mcpServers',
  'enabledPlugins',
  'apiKeyHelper',
] as const

/** CLI env vars that silently beat what gonggong sets (e.g. the bot's effort): reported as conflicts. */
export const CLAUDE_CONFLICT_ENV = [
  'CLAUDE_CODE_EFFORT_LEVEL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_BASE_URL',
  'MAX_THINKING_TOKENS',
] as const

/** Env names whose values leave the machine masked (like the API key); a masked value sent back = unchanged. */
export const SECRET_ENV_NAME = /KEY|TOKEN|SECRET|PASSWORD/i

/** Field id → raw value as the field's type describes; absent = Claude Code's default. */
export const AgentSettingValues = z.record(z.string(), z.string())
export type AgentSettingValues = z.infer<typeof AgentSettingValues>

/** A machine's defaults for one agent kind. `inheritCli`: also load the CLI's user-level config (~/.claude). */
export const AgentSettings = z.object({
  values: AgentSettingValues,
  inheritCli: z.boolean(),
})
export type AgentSettings = z.infer<typeof AgentSettings>

/** What the machine's own CLI config (~/.claude/settings.json) sets, for 生效值来源; known fields only. */
export const CliSettingsSnapshot = z.object({
  values: AgentSettingValues,
  /** CLAUDE_CONFLICT_ENV names it sets. */
  conflicts: z.array(z.string()),
  hooks: z.number().int(),
  permissionRules: z.number().int(),
  /** Claude Code version the adapter runs; null = unknown. */
  version: z.string().nullable(),
})
export type CliSettingsSnapshot = z.infer<typeof CliSettingsSnapshot>

/** Where a setting's effective value comes from, lowest precedence first. */
export const SETTING_SOURCES = ['default', 'cli', 'agent', 'provider', 'model', 'bot'] as const
export type SettingSource = (typeof SETTING_SOURCES)[number]

/** What a run started with (session.config), shown in the run detail. */
export const RunSettingsSnapshot = z.object({
  provider: z.string().nullable(),
  contextWindow: z.number().int().nullable(),
  autoCompactWindow: z.number().int().nullable(),
  inheritCli: z.boolean(),
  /** Field ids and conflict env names whose value came from the CLI's own config. */
  fromCli: z.array(z.string()),
  /** Bot override field ids applied. */
  fromBot: z.array(z.string()),
})
export type RunSettingsSnapshot = z.infer<typeof RunSettingsSnapshot>

export const fieldsFor = (
  agent: AgentKind,
  layer?: AgentSettingField['layer'],
): readonly AgentSettingField[] =>
  AGENT_SETTING_FIELDS.filter((f) => f.agent === agent && (!layer || f.layer === layer))
