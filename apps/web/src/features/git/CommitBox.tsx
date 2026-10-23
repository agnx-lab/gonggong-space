import type { GitHeadCommit } from '@gonggong/protocol'
import { type KeyboardEvent, useState } from 'react'
import { t } from '../../i18n'
import { Button, Checkbox, Icon, Popover, Spinner, Tooltip } from '../../ui'
import { type GitTarget, gitActionTaken, runGitAction } from './api'
import { gitCommands, inTarget } from './commands'
import { useOwner } from './owner'

const HISTORY = 'gg.git.messages'
const HISTORY_MAX = 20

const loadHistory = (botId: string): string[] => {
  try {
    return (JSON.parse(localStorage.getItem(HISTORY) ?? '{}') as Record<string, string[]>)[botId] ?? []
  } catch {
    return []
  }
}
const remember = (botId: string, message: string) => {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY) ?? '{}') as Record<string, string[]>
    all[botId] = [message, ...(all[botId] ?? []).filter((m) => m !== message)].slice(0, HISTORY_MAX)
    localStorage.setItem(HISTORY, JSON.stringify(all))
  } catch {
    // storage unavailable: no history this time
  }
}

/**
 * IDEA's commit message area: the message (with the ones committed before), Amend of the last commit, and Commit /
 * Commit and Push; ⌘↩ commits. `paths` are the picked files (a rename's both sides); none with Amend rewords only.
 */
export function CommitBox({
  target,
  paths,
  head,
  total,
  onCommitted,
}: {
  target: GitTarget
  paths: string[]
  head: GitHeadCommit | null
  /** Files in the change list, to tell "nothing picked" from "nothing changed". */
  total: number
  onCommitted: () => void
}) {
  const { owner } = useOwner(target.botId)
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [busy, setBusy] = useState(false)
  const text = message.trim()
  const ready = !busy && !!text && (paths.length > 0 || amend)
  const commit = async (push: boolean) => {
    if (!ready) return
    setBusy(true)
    const op = await runGitAction(
      target.groupId,
      target.botId,
      inTarget(target, { action: 'commit', message: text, paths, amend }),
    )
    setBusy(false)
    if (!gitActionTaken(op)) return
    remember(target.botId, text)
    setMessage('')
    setAmend(false)
    onCommitted()
    if (push && op?.status === 'succeeded') gitCommands(target).push()
  }
  const keyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    void commit(false)
  }
  const toggleAmend = (on: boolean) => {
    setAmend(on)
    if (on && !text && head) setMessage(head.message.trim())
    if (!on && head && text === head.message.trim()) setMessage('')
  }
  const history = loadHistory(target.botId)
  return (
    <div className="gc-box">
      <div className="gc-box__head">
        <Checkbox label={t('修改上一次提交')} checked={amend} disabled={!head} onChange={toggleAmend} />
        {amend && head?.pushed ? (
          <Tooltip content={t('该提交已推送，修改后需要强制推送才能更新远程')}>
            <span className="gc-box__warn" role="img" aria-label={t('已推送')}>
              <Icon name="warning" size={12} />
            </span>
          </Tooltip>
        ) : null}
        <span className="spacer" />
        <Popover
          portal
          placement="top-end"
          width={360}
          aria-label={t('最近的提交说明')}
          trigger={
            <button
              type="button"
              className="gc-box__icon"
              aria-label={t('最近的提交说明')}
              title={t('最近的提交说明')}
              disabled={!history.length}
            >
              <Icon name="clock" size={13} />
            </button>
          }
        >
          {(close) => (
            <ul className="gc-history">
              {history.map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    className="gc-history__item"
                    onClick={() => {
                      setMessage(m)
                      close()
                    }}
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>
      </div>
      <textarea
        className="gc-box__message"
        aria-label={t('提交说明')}
        placeholder={amend ? t('修改后的提交说明') : t('提交说明')}
        value={message}
        rows={3}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={keyDown}
      />
      <div className="gc-box__actions">
        <span className="gc-box__hint">
          {paths.length
            ? t('已选 {n} / {total} 个文件', { n: paths.length, total })
            : amend
              ? t('只修改提交说明')
              : total
                ? t('勾选要提交的文件')
                : t('没有未提交的改动')}
        </span>
        <span className="spacer" />
        {owner ? (
          <Button size="small" disabled={!ready} onClick={() => void commit(true)}>
            {amend ? t('修改并推送…') : t('提交并推送…')}
          </Button>
        ) : null}
        <Button size="small" variant="primary" disabled={!ready} onClick={() => void commit(false)}>
          {busy ? <Spinner size={12} /> : null}
          {owner ? (amend ? t('修改提交') : t('提交')) : t('提交申请')}
        </Button>
      </div>
    </div>
  )
}
