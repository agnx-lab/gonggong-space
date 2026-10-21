import type { GitDiffDto } from '@gonggong/protocol'
import { useEffect, useState } from 'react'
import { t } from '../../i18n'
import { api, errorText } from '../../lib/api'
import { EmptyState, NoChangesArt, Spinner } from '../../ui'
import { DiffView } from './DiffParts'
import { type DiffFile, parsePatch } from './patch'

interface GitDiff {
  url: string
  files: DiffFile[]
  truncated: boolean
  error: string | null
}

/** A `…/git/diff` read, parsed; null while loading. A new `stamp` reads again, keeping the old diff meanwhile. */
export function useGitDiff(url: string, stamp = '') {
  const [state, setState] = useState<GitDiff | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the stamp only marks the work tree as changed
  useEffect(() => {
    let live = true
    api.get<GitDiffDto>(url).then(
      (r) => live && setState({ url, files: parsePatch(r.patch ?? ''), truncated: r.truncated, error: null }),
      (e: unknown) => live && setState({ url, files: [], truncated: false, error: errorText(e) }),
    )
    return () => {
      live = false
    }
  }, [url, stamp])
  return state?.url === url ? state : null
}

/** One file's diff read from `url` (gitUrls.diff with its path); `stamp` re-reads a work tree diff. */
export function GitFileDiff({ url, path, stamp }: { url: string; path: string; stamp?: string }) {
  const diff = useGitDiff(url, stamp)
  const body = () => {
    if (!diff)
      return (
        <div className="diff-pane__state">
          <Spinner />
        </div>
      )
    if (diff.error)
      return <EmptyState compact icon="warning" title={t('无法读取差异')} description={diff.error} />
    const file = diff.files.find((f) => f.path === path) ?? diff.files[0]
    // A patch cut before its first hunk has nothing to show but the note.
    if (!file)
      return diff.truncated ? null : (
        <EmptyState compact illustration={<NoChangesArt />} title={t('没有差异')} />
      )
    if (file.binary)
      return <EmptyState compact icon="doc" title={t('二进制文件，无法显示差异')} description={file.path} />
    return <DiffView file={file} />
  }
  return (
    <div className="git-diff" data-testid="git-diff">
      {diff?.truncated ? (
        <div className="git-diff__note" role="status">
          {t('差异过大，已截断')}
        </div>
      ) : null}
      {body()}
    </div>
  )
}
