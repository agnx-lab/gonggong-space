import type { McpSecretCard as Card, MessageDto } from '@gonggong/protocol'
import { memo } from 'react'
import { t } from '../../i18n'
import { ChatNotice, Icon, Tag } from '../../ui'

/** A legacy 填写密钥 card for an MCP server: read-only since MCP values reference secrets instead. */
export const McpSecretCard = memo(function McpSecretCard({ m, card }: { m: MessageDto; card: Card }) {
  return (
    <ChatNotice>
      <span className="tl-event" data-testid="mcp-secret-card">
        <Icon name="lock" size={13} />
        <span className="tl-event__text">{m.i18n ? t.text(m.i18n) : m.body}</span>
        {card.filled ? (
          <Tag tone="green">{t('已填写')}</Tag>
        ) : (
          <Tag tone="gray">{t('已停用，请改用密钥')}</Tag>
        )}
      </span>
    </ChatNotice>
  )
})
