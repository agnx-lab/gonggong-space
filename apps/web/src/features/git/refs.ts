import type { GitBranch, GitRefsDto } from '@gonggong/protocol'

/** A decoration of a commit in the log (`git log --decorate=short`). */
export type CommitRef =
  | { kind: 'head'; name: 'HEAD' }
  | { kind: 'local'; name: string; current: boolean }
  | { kind: 'remote'; name: string }
  | { kind: 'tag'; name: string }

/**
 * Typed decorations: `HEAD -> main` is HEAD plus the current branch, `tag: v1` a tag, `origin/x` a remote branch when
 * `origin` is one of `remotes` (local names may hold slashes too); `<remote>/HEAD` only points at another one.
 */
export function parseRefs(refs: readonly string[], remotes: readonly string[]): CommitRef[] {
  const out: CommitRef[] = []
  for (const raw of refs) {
    const arrow = raw.match(/^HEAD -> (.+)$/)
    if (arrow?.[1]) {
      out.push({ kind: 'head', name: 'HEAD' }, { kind: 'local', name: arrow[1], current: true })
    } else if (raw === 'HEAD') out.push({ kind: 'head', name: 'HEAD' })
    else if (raw.startsWith('tag: ')) out.push({ kind: 'tag', name: raw.slice(5) })
    else if (remotes.some((r) => raw.startsWith(`${r}/`))) {
      if (!raw.endsWith('/HEAD')) out.push({ kind: 'remote', name: raw })
    } else out.push({ kind: 'local', name: raw, current: false })
  }
  return out
}

/** A branch folder (names split at `/`) or a branch. */
export type BranchNode =
  | { kind: 'folder'; path: string; name: string; children: BranchNode[] }
  | { kind: 'branch'; name: string; label: string; branch: GitBranch }

/**
 * Branches as a tree of `/` folders (IDEA's Group by Directory), folders first, each level sorted; `strip` drops a
 * leading prefix from the shown labels (a remote's name under its own node).
 */
export function branchTree(branches: readonly GitBranch[], strip = ''): BranchNode[] {
  const root: BranchNode[] = []
  for (const b of branches) {
    const rel = strip && b.name.startsWith(strip) ? b.name.slice(strip.length) : b.name
    const parts = rel.split('/')
    let level = root
    let path = strip
    for (const part of parts.slice(0, -1)) {
      path = `${path}${part}/`
      let folder = level.find(
        (n): n is Extract<BranchNode, { kind: 'folder' }> => n.kind === 'folder' && n.path === path,
      )
      if (!folder) {
        folder = { kind: 'folder', path, name: part, children: [] }
        level.push(folder)
      }
      level = folder.children
    }
    level.push({ kind: 'branch', name: b.name, label: parts.at(-1) ?? rel, branch: b })
  }
  const sort = (nodes: BranchNode[]): BranchNode[] =>
    nodes
      .map((n) => (n.kind === 'folder' ? { ...n, children: sort(n.children) } : n))
      .sort((a, b) =>
        a.kind !== b.kind
          ? a.kind === 'folder'
            ? -1
            : 1
          : (a.kind === 'folder' ? a.name : a.label).localeCompare(b.kind === 'folder' ? b.name : b.label),
      )
  return sort(root)
}

/** Remote-tracking branches by remote, `<remote>/HEAD` left out. */
export function remoteGroups(refs: GitRefsDto): { remote: string; branches: GitBranch[] }[] {
  const remotes = refs.remotes.map((r) => r.name)
  const remote = refs.branches.filter((b) => b.kind === 'remote' && !b.name.endsWith('/HEAD'))
  const named = remotes.map((r) => ({
    remote: r,
    branches: remote.filter((b) => b.name.startsWith(`${r}/`)),
  }))
  return named.filter((g) => g.branches.length)
}

/** The remote and branch of a remote-tracking name (`origin/feat/x` → origin, feat/x), given the remotes. */
export function splitRemote(
  name: string,
  remotes: readonly string[],
): { remote: string; branch: string } | null {
  const remote = remotes.find((r) => name.startsWith(`${r}/`))
  return remote ? { remote, branch: name.slice(remote.length + 1) } : null
}

const FAVORITES = 'gg.git.favorites'

/** Branches starred in this browser, per bot; the group's base branch is a favourite until unstarred. */
export function loadFavorites(botId: string): Set<string> | null {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES) ?? '{}') as Record<string, string[]>
    return all[botId] ? new Set(all[botId]) : null
  } catch {
    return null
  }
}

export function saveFavorites(botId: string, names: ReadonlySet<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES) ?? '{}') as Record<string, string[]>
    all[botId] = [...names]
    localStorage.setItem(FAVORITES, JSON.stringify(all))
  } catch {
    // storage unavailable: stars last for this page only
  }
}
