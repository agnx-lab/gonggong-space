import { useState } from 'react'
import { t } from '../../i18n'
import { copyWithToast } from '../../lib/clipboard'
import { Icon } from '../../ui'
import type { RunIssue } from './issue'

const HEAD_LINES = 4

/** Why the run failed or waits, its reason in full (folded past a few lines) and what to do about it. */
export function IssueBanner({ issue }: { issue: RunIssue }) {
  const [all, setAll] = useState(false)
  const lines = issue.detail.replace(/\n+$/, '').split('\n')
  const folded = !all && lines.length > HEAD_LINES
  const error = issue.tone === 'error'
  return (
    <div className="run-issue" data-tone={issue.tone} role={error ? 'alert' : 'status'}>
      <div className="run-issue__head">
        <Icon name={error ? 'exclamation-circle' : 'info'} size={14} />
        <span className="run-issue__title">{issue.title}</span>
        {error && issue.detail ? (
          <button
            type="button"
            className="run-tab__copy"
            aria-label={t('复制错误信息')}
            title={t('复制错误信息')}
            onClick={() => void copyWithToast(issue.detail, t('已复制错误信息'))}
          >
            <Icon name="copy" size={12} />
          </button>
        ) : null}
      </div>
      {issue.detail ? (
        <pre className="run-issue__detail">{(folded ? lines.slice(0, HEAD_LINES) : lines).join('\n')}</pre>
      ) : null}
      {folded ? (
        <button type="button" className="run-issue__more" onClick={() => setAll(true)}>
          {t('展开全部')}
        </button>
      ) : null}
      {issue.hint ? <div className="run-issue__hint">{issue.hint}</div> : null}
    </div>
  )
}
