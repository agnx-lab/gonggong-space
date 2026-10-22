import type { GitActionReq, GitOperationDto, GitRefsDto } from '@gonggong/protocol'
import { useEffect, useState } from 'react'
import { putGitOperation, useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { api, errorText } from '../../lib/api'
import { toastError } from '../../lib/errors'
import { toast } from '../../ui'
import { gitOperationSettled } from './notify'

export const gitBase = (groupId: string, botId: string) => `/groups/${groupId}/bots/${botId}/git`

const enc = encodeURIComponent
export const gitUrls = {
  log: (base: string, ref: string | null, skip: number) =>
    `${base}/log?${ref ? `ref=${enc(ref)}&` : ''}skip=${skip}`,
  tree: (base: string, ref: string, path: string) => `${base}/tree?ref=${enc(ref)}&path=${enc(path)}`,
  text: (base: string, ref: string, path: string) => `${base}/text?ref=${enc(ref)}&path=${enc(path)}`,
  compare: (base: string, from: string, to: string | null) =>
    `${base}/compare?from=${enc(from)}${to ? `&to=${enc(to)}` : ''}`,
  /** `to` null = the work tree; `path` null = every file. */
  diff: (base: string, from: string, to: string | null, path: string | null) =>
    `${base}/diff?from=${enc(from)}${to ? `&to=${enc(to)}` : ''}${path ? `&path=${enc(path)}` : ''}`,
}

/** Re-reads a bot's git status (it arrives as a bot state update); `fetch` fetches the remotes first. */
export async function refreshGit(groupId: string, botId: string, fetch = false) {
  await api.post(`${gitBase(groupId, botId)}/refresh`, { fetch })
}

/** A refresh on opening a git view: the view works on the last status anyway, so a failure stays silent. */
export const refreshGitQuietly = (groupId: string, botId: string) => {
  refreshGit(groupId, botId).catch(() => {})
}

/** A full commit hash reads better shortened; branch names stay as they are. */
export const shortRev = (rev: string) => (/^[0-9a-f]{40}$/i.test(rev) ? rev.slice(0, 7) : rev)

/** Branches and remotes of a bot workspace (of one of its sub-repos when `repo` is given), read once per mount. */
export function useGitRefs(groupId: string, botId: string, repo?: string) {
  const [state, setState] = useState<{ refs: GitRefsDto | null; error: string | null }>({
    refs: null,
    error: null,
  })
  useEffect(() => {
    let live = true
    api.get<GitRefsDto>(`${gitBase(groupId, botId)}/refs${repo ? `?repo=${enc(repo)}` : ''}`).then(
      (refs) => live && setState({ refs, error: null }),
      (e: unknown) => live && setState({ refs: null, error: errorText(e) }),
    )
    return () => {
      live = false
    }
  }, [groupId, botId, repo])
  return state
}

/**
 * Runs (owner) or requests (anyone else) a git action; resolves the operation, or null when the server refused it
 * (a busy bot's 409 and other refusals toast the server's message).
 */
export async function runGitAction(
  groupId: string,
  botId: string,
  req: GitActionReq,
): Promise<GitOperationDto | null> {
  try {
    const op = await api.post<GitOperationDto>(`${gitBase(groupId, botId)}/actions`, req)
    putGitOperation(op)
    const { bots } = useWorkspace.getState()
    if (op.status === 'pending_approval') {
      const owner = bots.find((b) => b.id === botId)?.ownerName ?? ''
      toast({ type: 'info', message: t('已提交申请，等待 Bot 主人 {name} 审批', { name: owner }) })
    } else gitOperationSettled(op, bots)
    return op
  } catch (e) {
    toastError(e)
    return null
  }
}

/** Whether a dialog can close: a failed or refused operation keeps it open, to fix and try again. */
export const gitActionTaken = (op: GitOperationDto | null) => !!op && op.status !== 'failed'

export async function decideGitOperation(id: string, approve: boolean) {
  try {
    putGitOperation(await api.post<GitOperationDto>(`/git-operations/${id}/decide`, { approve }))
  } catch (e) {
    toastError(e)
  }
}
