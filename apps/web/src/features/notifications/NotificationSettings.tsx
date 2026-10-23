import type { FeishuIdentityView } from '@gonggong/protocol'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { t } from '../../i18n'
import { api } from '../../lib/api'
import { toastError } from '../../lib/errors'
import { useGet } from '../../lib/useGet'
import { Button, GroupBox, GroupRow, Switch, toast } from '../../ui'
import { useAuthOptions } from '../auth/options'
import { feishuStartUrl } from '../feishu/login'
import { enablePush, type PushState, pushState } from './push'

/** 「开启浏览器通知」, or where this browser's permission stands. */
export function PushAction() {
  const [state, setState] = useState<PushState>(pushState)
  if (state === 'unsupported') return null
  if (state === 'granted') return <span>{t('浏览器通知已开启')}</span>
  if (state === 'denied') return <span>{t('浏览器通知已被禁止，请在浏览器设置中允许')}</span>
  return (
    <Button
      size="small"
      variant="plain"
      onClick={() =>
        enablePush().then(setState, (e: Error) =>
          toast({ type: 'error', title: t('开启浏览器通知失败'), message: e.message }),
        )
      }
    >
      {t('开启浏览器通知')}
    </Button>
  )
}

/** 设置 · 通知: where notifications that need you are delivered besides the in-app center. */
export function NotificationSettings() {
  return (
    <GroupBox>
      {pushState() === 'unsupported' ? null : (
        <GroupRow label={t('浏览器通知')}>
          <PushAction />
        </GroupRow>
      )}
      <FeishuNotifyRow />
    </GroupBox>
  )
}

function FeishuNotifyRow() {
  const options = useAuthOptions()
  const { data, reload } = useGet<FeishuIdentityView>('/me/feishu')
  const { pathname, search } = useLocation()
  const identity = data?.identity ?? null
  if (!data || (!identity && !options?.feishuLogin)) return null
  return (
    <GroupRow
      label={t('飞书通知')}
      description={
        identity
          ? t('需要你处理的通知同时以卡片发到飞书，由「共工」应用私聊你；正在查看的群不重复发')
          : t('绑定飞书账号后可开启')
      }
    >
      <span className="gs-value-line">
        {identity ? null : (
          <a className="ui-btn ui-btn--small feishu-login" href={feishuStartUrl(pathname + search, 'link')}>
            {t('绑定飞书')}
          </a>
        )}
        <Switch
          aria-label={t('飞书通知')}
          checked={identity?.notify ?? false}
          disabled={!identity}
          onChange={(notify) => api.put('/me/feishu/notify', { notify }).then(reload, toastError)}
        />
      </span>
    </GroupRow>
  )
}
