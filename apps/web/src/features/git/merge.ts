/** A run of lines both sides agree on, or a conflict as git's diff3 merge left it. */
export type MergeSegment =
  | { kind: 'same'; lines: string[] }
  | { kind: 'conflict'; id: number; ours: string[]; base: string[]; theirs: string[] }

/** How one conflict is settled: a side, both in either order, or text typed in. */
export type Resolution = 'ours' | 'theirs' | 'ours-theirs' | 'theirs-ours' | { text: string }

const OPEN = /^<{7}(?: |$)/
const BASE = /^\|{7}(?: |$)/
const SPLIT = /^={7}$/
const CLOSE = /^>{7}(?: |$)/

/**
 * `git merge-file --diff3` output as segments; null when its markers don't nest as git writes them (then only a whole
 * side or the raw text can be taken). Line ends are kept off the lines; a trailing newline shows as a last ''.
 */
export function parseMerge(merged: string): MergeSegment[] | null {
  const lines = merged.split('\n')
  const out: MergeSegment[] = []
  let same: string[] = []
  let conflict: { ours: string[]; base: string[]; theirs: string[] } | null = null
  let part: 'ours' | 'base' | 'theirs' = 'ours'
  let id = 0
  for (const line of lines) {
    if (!conflict) {
      if (OPEN.test(line)) {
        if (same.length) out.push({ kind: 'same', lines: same })
        same = []
        conflict = { ours: [], base: [], theirs: [] }
        part = 'ours'
      } else if (BASE.test(line) || SPLIT.test(line) || CLOSE.test(line)) return null
      else same.push(line)
      continue
    }
    if (OPEN.test(line)) return null
    if (BASE.test(line) && part === 'ours') part = 'base'
    else if (SPLIT.test(line) && part !== 'theirs') part = 'theirs'
    else if (CLOSE.test(line) && part === 'theirs') {
      out.push({ kind: 'conflict', id: id++, ...conflict })
      conflict = null
    } else conflict[part].push(line)
  }
  if (conflict) return null
  if (same.length) out.push({ kind: 'same', lines: same })
  return out
}

/** The lines a resolution puts in place of its conflict. */
export function resolved(c: Extract<MergeSegment, { kind: 'conflict' }>, r: Resolution): string[] {
  if (typeof r === 'object') return r.text === '' ? [] : r.text.split('\n')
  if (r === 'ours') return c.ours
  if (r === 'theirs') return c.theirs
  return r === 'ours-theirs' ? [...c.ours, ...c.theirs] : [...c.theirs, ...c.ours]
}

/**
 * The file as resolved so far; a conflict without a resolution keeps git's markers (labelled `ours` / `theirs`, base
 * left out), so the text still says what is left to do.
 */
export function assemble(segments: MergeSegment[], resolutions: ReadonlyMap<number, Resolution>): string {
  const lines: string[] = []
  for (const s of segments) {
    if (s.kind === 'same') {
      lines.push(...s.lines)
      continue
    }
    const r = resolutions.get(s.id)
    if (r) lines.push(...resolved(s, r))
    else lines.push('<<<<<<< ours', ...s.ours, '=======', ...s.theirs, '>>>>>>> theirs')
  }
  return lines.join('\n')
}

/** Whether `text` still holds conflict markers. */
export const hasMarkers = (text: string) => text.split('\n').some((l) => OPEN.test(l) || CLOSE.test(l))

/** A conflict both sides changed the same way needs no choice. */
export const sameOnBothSides = (c: Extract<MergeSegment, { kind: 'conflict' }>) =>
  c.ours.length === c.theirs.length && c.ours.every((l, i) => l === c.theirs[i])
