import { z } from 'zod'

// ── Rich UI blocks (plan 富交互消息): fenced code blocks in a bot reply, rendered as components ─────────────────────
// A block whose content fails its schema stays a plain code block: never an error, never blank.

const label = z.string().min(1).max(80)
const num = z.number().finite()

/** ```chart — JSON. `x`: category labels (line/bar/area/scatter); pie uses `x` as slice names and series[0] values. */
export const ChartBlock = z.object({
  type: z.enum(['line', 'bar', 'area', 'pie', 'scatter']),
  title: z.string().max(120).optional(),
  x: z.array(z.union([z.string().max(80), num])).max(1000),
  series: z
    .array(z.object({ name: label, data: z.array(num.nullable()).max(1000) }))
    .min(1)
    .max(20),
  unit: z.string().max(20).optional(),
  stacked: z.boolean().optional(),
})
export type ChartBlock = z.infer<typeof ChartBlock>

/** ```metrics — JSON array of stat tiles. `delta`: a number shown signed (e.g. -3.2) or a short text as is; `tone` colors it. */
export const MetricsBlock = z
  .array(
    z.object({
      label,
      value: z.union([z.string().max(40), num]),
      unit: z.string().max(20).optional(),
      delta: z.union([num, z.string().max(40)]).optional(),
      tone: z.enum(['good', 'bad', 'neutral']).optional(),
      trend: z.array(num).max(100).optional(),
    }),
  )
  .min(1)
  .max(8)
export type MetricsBlock = z.infer<typeof MetricsBlock>

/** ```timeline — JSON array, in display order. */
export const TimelineBlock = z
  .array(
    z.object({
      time: z.string().max(40),
      title: z.string().min(1).max(120),
      detail: z.string().max(500).optional(),
      status: z.enum(['done', 'running', 'pending', 'failed']).optional(),
    }),
  )
  .min(1)
  .max(50)
export type TimelineBlock = z.infer<typeof TimelineBlock>

/**
 * ```actions — JSON. Buttons under the reply: a click posts `@<bot> 选择了「<label>」` (quoting the reply) as the
 * clicker, which starts the bot's next turn. `id` names the block within the reply; it can be answered once.
 */
export const ActionsBlock = z.object({
  id: z
    .string()
    .regex(/^[\w-]{1,40}$/)
    .default('actions'),
  prompt: z.string().max(200).optional(),
  options: z
    .array(
      z.object({
        label,
        /** Sent instead of the label when given. */
        value: z.string().max(200).optional(),
        style: z.enum(['primary', 'default', 'danger']).optional(),
      }),
    )
    .min(1)
    .max(8),
  /** Pick several, then 提交. */
  multiple: z.boolean().optional(),
})
export type ActionsBlock = z.infer<typeof ActionsBlock>

export const MERMAID_MAX = 20_000
/** ```widget — one self-contained HTML page (inline CSS/JS, no network), shown in a sandboxed iframe. */
export const WIDGET_MAX = 512 * 1024

export const UI_BLOCK_LANGS = ['chart', 'metrics', 'timeline', 'actions', 'mermaid', 'widget'] as const
export type UiBlockLang = (typeof UI_BLOCK_LANGS)[number]

export type UiBlock =
  | { lang: 'chart'; data: ChartBlock }
  | { lang: 'metrics'; data: MetricsBlock }
  | { lang: 'timeline'; data: TimelineBlock }
  | { lang: 'actions'; data: ActionsBlock }
  | { lang: 'mermaid'; source: string }
  | { lang: 'widget'; html: string }

const json = <T>(schema: z.ZodType<T>, raw: string): T | null => {
  try {
    const r = schema.safeParse(JSON.parse(raw))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

/** The block a fenced code block of language `lang` holds; null = not a UI block, or invalid (render as code). */
export function parseUiBlock(lang: string, raw: string): UiBlock | null {
  switch (lang) {
    case 'chart': {
      const data = json(ChartBlock, raw)
      return data && { lang, data }
    }
    case 'metrics': {
      const data = json(MetricsBlock, raw)
      return data && { lang, data }
    }
    case 'timeline': {
      const data = json(TimelineBlock, raw)
      return data && { lang, data }
    }
    case 'actions': {
      const data = json(ActionsBlock, raw)
      return data && { lang, data }
    }
    case 'mermaid':
      return raw.trim() && raw.length <= MERMAID_MAX ? { lang, source: raw } : null
    case 'widget':
      return raw.trim() && raw.length <= WIDGET_MAX ? { lang, html: raw } : null
    default:
      return null
  }
}

const FENCE = /^(`{3,}|~{3,})[ \t]*([\w-]+)[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm

/** Every closed UI block of a Markdown text, with where it sits (for replacing it with a summary). */
export function findUiBlocks(markdown: string) {
  const out: { start: number; end: number; block: UiBlock }[] = []
  for (const m of markdown.matchAll(FENCE)) {
    const block = parseUiBlock(m[2] ?? '', m[3] ?? '')
    if (block) out.push({ start: m.index, end: m.index + m[0].length, block })
  }
  return out
}

/** One line standing in for a block where it can't render (Feishu, notifications, search snippets). Chinese. */
export function summarizeUiBlock(b: UiBlock): string {
  switch (b.lang) {
    case 'chart':
      return `📊 ${b.data.title ?? '图表'}（${b.data.series.map((s) => s.name).join('、')}）`
    case 'metrics':
      return b.data.map((m) => `${m.label} ${m.value}${m.unit ?? ''}`).join(' · ')
    case 'timeline':
      return b.data.map((e) => `${e.time} ${e.title}`).join('；')
    case 'actions':
      return `${b.data.prompt ?? '请选择'}：${b.data.options.map((o) => o.label).join(' / ')}`
    case 'mermaid':
      return '🔀 流程图'
    case 'widget':
      return '🧩 交互页面'
  }
}

/** Who answered an actions block of a reply (MessageDto.actions, keyed by block id). */
export const ActionAnswer = z.object({
  userId: z.string(),
  name: z.string(),
  labels: z.array(z.string()),
  at: z.string(),
})
export type ActionAnswer = z.infer<typeof ActionAnswer>
/** POST /api/messages/:id/actions — answers the reply's block `blockId` with the chosen option indexes. */
export const AnswerActionsReq = z.object({
  blockId: z.string().regex(/^[\w-]{1,40}$/),
  options: z.array(z.number().int().min(0).max(7)).min(1).max(8),
})
export type AnswerActionsReq = z.infer<typeof AnswerActionsReq>

/** Agent-facing guide to the blocks (not translated), added to every bot's system prompt. */
export const UI_BLOCKS_GUIDE = `Your replies are Markdown rendered in a chat. Besides text, tables and code, these fenced code blocks render as components; use them only when they show something better than prose, keep data small, and still state the conclusion in text:
- \`\`\`chart: JSON {"type":"line|bar|area|pie|scatter","title"?,"x":[labels],"series":[{"name","data":[numbers]}],"unit"?,"stacked"?}; pie: x = slice names, series[0].data = values.
- \`\`\`metrics: JSON array of up to 8 tiles [{"label","value","unit"?,"delta"?,"tone"?:"good|bad|neutral","trend"?:[numbers]}].
- \`\`\`timeline: JSON array [{"time","title","detail"?,"status"?:"done|running|pending|failed"}].
- \`\`\`mermaid: Mermaid source for flowcharts, sequence, architecture and gantt diagrams.
- \`\`\`actions: JSON {"id"?,"prompt"?,"options":[{"label","value"?,"style"?:"primary|default|danger"}],"multiple"?} — buttons; a member's click comes back to you as a new message "@you 选择了「label」". Use for a choice you need from them; end your turn after it.
- \`\`\`widget: one self-contained HTML page (inline CSS/JS, no external scripts, no network: the data must be inside) for an interactive view the blocks above can't express; shown in a sandboxed frame, at most 512 KB. Prefer the blocks above.
Invalid JSON shows as a plain code block. Do not use these for ordinary code samples.`
