import type { KnowledgeDetailDto } from '@gonggong/protocol'
import { useEffect, useState } from 'react'
import { useWorkbench } from '../../../app/workbench'
import { t } from '../../../i18n'
import { realtime } from '../../../lib/realtime'
import { ago } from '../../../lib/time'
import { useGet } from '../../../lib/useGet'
import { Button, EmptyState, Presence, Spinner } from '../../../ui'
import { Markdown } from '../../chat/Markdown'
import { Author, KnowledgeEditor } from '../../knowledge/KnowledgeEditor'
import type { TabMeta, TabProps } from '../types'
import './knowledge-tab.css'

/** A knowledge entry pinned in the group's tab bar, read-only here; 编辑 opens the usual editor. */
export function KnowledgeTab({ tab }: TabProps<'knowledge'>) {
  const groupId = useWorkbench((s) => s.groupId) ?? ''
  const { data, error, reload } = useGet<KnowledgeDetailDto>(`/knowledge/${tab.knowledgeId}`)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    const off = realtime.subscribe((e) => {
      if (e.t === 'group.knowledge' && e.entryId === tab.knowledgeId) reload()
    })
    return off
  }, [tab.knowledgeId, reload])

  if (error)
    return (
      <EmptyState
        icon="doc-text"
        title={t('条目已删除或无法读取')}
        action={<Button onClick={reload}>{t('重试')}</Button>}
      />
    )
  if (!data) return <Spinner />
  return (
    <div className="wt-kb">
      <header className="wt-kb__head">
        <h2 className="wt-kb__title">{data.title}</h2>
        <span className="wt-kb__meta">
          <Author by={data.updatedBy} />
          <span>{t('{ago} 更新 · v{n}', { ago: ago(data.updatedAt), n: data.version })}</span>
        </span>
        <Button size="small" onClick={() => setEditing(true)}>
          {t('编辑')}
        </Button>
      </header>
      <div className="wt-kb__body">
        <Markdown text={data.body} />
      </div>
      <Presence>
        {editing ? (
          <KnowledgeEditor
            groupId={groupId}
            entryId={tab.knowledgeId}
            onSaved={reload}
            onClose={() => setEditing(false)}
          />
        ) : null}
      </Presence>
    </div>
  )
}

export function useKnowledgeTabMeta(tab: TabProps<'knowledge'>['tab']): TabMeta {
  return { icon: 'doc-text', title: tab.title }
}
