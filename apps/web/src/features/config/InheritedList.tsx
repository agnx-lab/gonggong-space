import type { ReactNode } from 'react'
import { t } from '../../i18n'
import { api, errorText } from '../../lib/api'
import { useGet } from '../../lib/useGet'
import { Alert, GroupBox, GroupRow, Switch, Tag, toast } from '../../ui'

type Inherited = { scope: 'platform' | 'team'; enabledInGroup: boolean }
const SCOPE: Record<Inherited['scope'], string> = { platform: t('平台层'), team: t('团队层') }

/**
 * Platform and team items (skills, MCP servers) in effect for the group under `base`: read-only, each turned on or
 * off for this group alone.
 */
export function InheritedList<T extends Inherited>({
  base,
  row,
}: {
  base: string
  row: (item: T) => { name: string; label: string; tags: string[]; description: ReactNode }
}) {
  const { data, error, reload } = useGet<T[]>(base)
  const toggle = async (name: string, enabled: boolean) => {
    try {
      await api.put(`${base}/${encodeURIComponent(name)}`, { enabled })
    } catch (e) {
      toast({ type: 'error', title: t('保存失败'), message: errorText(e) })
    }
    reload()
  }
  if (error) return <Alert variant="error" title={t('配置加载失败')} description={error} />
  if (!data?.length) return null
  return (
    <>
      <div className="cfg__eyebrow">{t('继承自团队/平台')}</div>
      <div className="gs-note">{t('内容只读；在本群关闭只影响本群，团队和其他群照常加载。')}</div>
      <GroupBox>
        {data.map((item) => {
          const r = row(item)
          return (
            <GroupRow
              key={r.name}
              className="cfg__item"
              label={
                <span className="cfg__name-line">
                  <span className="cfg__name">{r.label}</span>
                  <Tag tone="gray">{SCOPE[item.scope]}</Tag>
                  {r.tags.map((tag) => (
                    <Tag key={tag} tone="gray">
                      {tag}
                    </Tag>
                  ))}
                </span>
              }
              description={r.description}
            >
              <Switch
                ariaLabel={t('在本群启用 {name}', { name: r.name })}
                checked={item.enabledInGroup}
                onChange={(on) => void toggle(r.name, on)}
              />
            </GroupRow>
          )
        })}
      </GroupBox>
    </>
  )
}
