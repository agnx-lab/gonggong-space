import type { McpSecretCard as Card, MessageDto } from '@gonggong/protocol'
import { memo, useState } from 'react'
import { useSession } from '../../app/session'
import { t } from '../../i18n'
import { api, errorText } from '../../lib/api'
import { Alert, Button, ChatNotice, Dialog, Icon, Presence, SecureField, Tag } from '../../ui'

/** A bot's 填写密钥 card: only the person it asks fills the values, which go straight into the MCP config. */
export const McpSecretCard = memo(function McpSecretCard({ m, card }: { m: MessageDto; card: Card }) {
  const mine = useSession((s) => s.user?.id === card.userId)
  const [open, setOpen] = useState(false)
  const [filled, setFilled] = useState(false)
  const done = card.filled || filled
  return (
    <ChatNotice>
      <span className="tl-event" data-testid="mcp-secret-card">
        <Icon name="lock" size={13} />
        <span className="tl-event__text">{m.i18n ? t.text(m.i18n) : m.body}</span>
        {done ? (
          <Tag tone="green">{t('已填写')}</Tag>
        ) : mine ? (
          <Button size="small" variant="primary" onClick={() => setOpen(true)}>
            {t('填写密钥')}
          </Button>
        ) : (
          <Tag tone="gray">{t('等待填写')}</Tag>
        )}
      </span>
      <Presence>
        {open ? (
          <SecretDialog
            card={card}
            onClose={() => setOpen(false)}
            onDone={() => {
              setFilled(true)
              setOpen(false)
            }}
          />
        ) : null}
      </Presence>
    </ChatNotice>
  )
})

function SecretDialog({ card, onClose, onDone }: { card: Card; onClose: () => void; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = card.keys.every((k) => values[k])
  const submit = async () => {
    setBusy(true)
    try {
      await api.post(`/mcp-secrets/${card.id}`, { values })
      onDone()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      title={t('填写 MCP「{name}」的密钥', { name: card.name })}
      message={t('直接写入 MCP 配置，Bot 看不到，也不会出现在聊天记录和日志里。')}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={[
        { label: t('取消'), onClick: onClose },
        { label: t('保存'), variant: 'primary', onClick: () => void submit(), disabled: !ready || busy },
      ]}
    >
      {error ? <Alert variant="error" title={error} /> : null}
      {card.keys.map((k) => (
        <SecureField
          key={k}
          label={k}
          autoComplete="new-password"
          value={values[k] ?? ''}
          onChange={(e) => setValues({ ...values, [k]: e.target.value })}
        />
      ))}
    </Dialog>
  )
}
