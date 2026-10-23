import { Icon } from '../../../ui'
import { type CommitRef, splitRemote } from '../refs'

/** A ref label of a commit, in IDEA's colours: HEAD and its branch, local and remote branches, tags. */
export interface RefLabel {
  kind: 'head' | 'current' | 'local' | 'remote' | 'tag'
  text: string
  title: string
}

/**
 * One label per ref, as IDEA draws them: a local branch and the remote branches of the same name share one label
 * (`origin & main`), HEAD's branch first.
 */
export function refLabels(refs: CommitRef[], remotes: readonly string[]): RefLabel[] {
  const locals = refs.filter((r) => r.kind === 'local').sort((a, b) => +b.current - +a.current)
  const remote = refs.filter((r) => r.kind === 'remote')
  const joined = new Set<string>()
  const out: RefLabel[] = []
  if (refs.some((r) => r.kind === 'head') && !locals.some((r) => r.current))
    out.push({ kind: 'head', text: 'HEAD', title: 'HEAD' })
  for (const l of locals) {
    const twins = remote.filter((r) => splitRemote(r.name, remotes)?.branch === l.name)
    for (const r of twins) joined.add(r.name)
    const names = twins.map((r) => splitRemote(r.name, remotes)?.remote)
    out.push({
      kind: l.current ? 'current' : 'local',
      text: [...names, l.name].join(' & '),
      title: [l.current ? `HEAD → ${l.name}` : l.name, ...twins.map((r) => r.name)].join(', '),
    })
  }
  for (const r of remote) if (!joined.has(r.name)) out.push({ kind: 'remote', text: r.name, title: r.name })
  for (const r of refs) if (r.kind === 'tag') out.push({ kind: 'tag', text: r.name, title: r.name })
  return out
}

/** The labels of a commit, the first `max` of them and a count of the rest. */
export function RefLabels({ labels, max = 3 }: { labels: RefLabel[]; max?: number }) {
  if (!labels.length) return null
  const shown = labels.length > max ? labels.slice(0, max - 1) : labels
  const rest = labels.slice(shown.length)
  return (
    <span className="glog-refs">
      {shown.map((l) => (
        <span key={`${l.kind}:${l.text}`} className="glog-ref" data-ref={l.kind} title={l.title}>
          {l.kind === 'tag' ? <Icon name="tag" size={10} /> : null}
          <span className="glog-ref__text">{l.text}</span>
        </span>
      ))}
      {rest.length ? (
        <span className="glog-ref glog-ref--more" title={rest.map((l) => l.title).join('\n')}>
          +{rest.length}
        </span>
      ) : null}
    </span>
  )
}
