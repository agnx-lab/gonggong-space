import { useWorkspace } from '../../../app/workspace'
import { t } from '../../../i18n'
import { EmptyState } from '../../../ui'
import type { TabMeta, TabProps } from '../types'

/** Two versions of a bot's repo: the commits on either side and the files that differ. */
export function GitCompareTab({ tab }: TabProps<'git-compare'>) {
  return <EmptyState compact icon="git-compare" title={`${tab.from} ↔ ${tab.to ?? t('工作区')}`} />
}

export function useGitCompareTabMeta(tab: TabProps<'git-compare'>['tab']): TabMeta {
  const name = useWorkspace((s) => s.bots.find((b) => b.id === tab.botId)?.name) ?? 'Bot'
  return { icon: 'git-compare', title: t('比较 · {name}', { name }) }
}
