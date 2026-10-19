import type { GroupDto } from '@gonggong/protocol'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { SecretLayerList } from './SecretLayer'

/** 群设置 · 密钥: the group layer over the inherited team and platform secrets; members only read it. */
export function GroupSecrets({ group, editable }: { group: GroupDto; editable: boolean }) {
  const bots = useWorkspace((s) => s.bots).filter((b) => group.botIds.includes(b.id))
  return (
    <>
      <div className="gs-note">
        {editable
          ? t('只对本群生效；与团队层、平台层同名时以群层为准。Bot 运行时以同名环境变量注入。')
          : t('仅群管理员可修改')}
      </div>
      <SecretLayerList base={`/groups/${group.id}/secrets`} scope="group" bots={bots} editable={editable} />
    </>
  )
}
