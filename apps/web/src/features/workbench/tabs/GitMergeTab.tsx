import { t } from '../../../i18n'
import { EmptyState } from '../../../ui'
import type { TabMeta, TabProps } from '../types'

/** The three-way merge of one conflicted file. */
export function GitMergeTab({ tab }: TabProps<'git-merge'>) {
  return <EmptyState compact icon="git-merge" title={tab.path} />
}

export function useGitMergeTabMeta(tab: TabProps<'git-merge'>['tab']): TabMeta {
  return {
    icon: 'git-merge',
    title: t('合并 · {name}', { name: tab.path.slice(tab.path.lastIndexOf('/') + 1) }),
  }
}
