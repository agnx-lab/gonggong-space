export interface MentionSpan {
  id: string
  start: number
  end: number
}

/** Explicit `@<bot name>` spans in order of appearance. Longest name wins at each `@`. */
export function scanMentions(body: string, bots: { id: string; name: string }[]): MentionSpan[] {
  const byLength = [...bots].sort((a, b) => b.name.length - a.name.length)
  const spans: MentionSpan[] = []
  for (let i = body.indexOf('@'); i !== -1; i = body.indexOf('@', i + 1)) {
    // Skip e-mail addresses like a@b.com.
    if (/[A-Za-z0-9._%+-]/.test(body[i - 1] ?? '')) continue
    const hit = byLength.find((b) => b.name && body.startsWith(b.name, i + 1))
    if (!hit) continue
    spans.push({ id: hit.id, start: i, end: i + 1 + hit.name.length })
    i += hit.name.length
  }
  return spans
}

/** Mentioned bot ids in order of appearance, deduped. */
export const parseMentions = (body: string, bots: { id: string; name: string }[]) => [
  ...new Set(scanMentions(body, bots).map((s) => s.id)),
]

/** Fenced blocks and inline code: an @ there is quoted, not addressed. */
const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g

/**
 * Mentioned member ids in order of appearance, deduped. Bots are matched too so that the longest name wins
 * (`@小王的 Claude` is the bot, not member 小王).
 */
export function mentionedMembers(
  body: string,
  members: { id: string; name: string }[],
  bots: { id: string; name: string }[],
  o: { skipCode?: boolean } = {},
) {
  const ids = new Set(members.map((m) => m.id))
  const text = o.skipCode ? body.replace(CODE, ' ') : body
  return [
    ...new Set(
      scanMentions(text, [...bots, ...members])
        .map((s) => s.id)
        .filter((id) => ids.has(id)),
    ),
  ]
}
