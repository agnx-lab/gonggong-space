import type { ContextUsage } from '@gonggong/protocol'
import { t } from '../../i18n'
import { toastError } from '../../lib/errors'
import { fmtTokens } from '../../lib/format'
import { Button, LevelIndicator, Popover } from '../../ui'
import { postMessage, uuid } from './MessageComposer'

const WARNING = 70
const CRITICAL = 90
const R = 5
const ARC = 2 * Math.PI * R

/** A bot's context window occupancy in this group, with /compact and /new at hand (both sent as group messages). */
export function ContextMeter({
  groupId,
  bot,
  context,
}: {
  groupId: string
  bot: string
  context: ContextUsage
}) {
  const pct = Math.min(100, Math.round((context.used / Math.max(1, context.size)) * 100))
  const level = pct >= CRITICAL ? 'critical' : pct >= WARNING ? 'warning' : 'normal'
  const detail = `${fmtTokens(context.used)} / ${fmtTokens(context.size)}`
  const compact = context.compactAt ? t('约在 {n} 时自动压缩', { n: fmtTokens(context.compactAt) }) : null
  // Where the compaction point sits on the ring, clockwise from the top.
  const angle = context.compactAt
    ? (Math.min(1, context.compactAt / Math.max(1, context.size)) - 0.25) * 2 * Math.PI
    : 0
  const send = (command: string) =>
    postMessage(groupId, {
      body: `/${command} @${bot}`,
      clientId: uuid(),
      attachmentIds: [],
      quote: null,
      appendTo: null,
    }).catch(toastError)
  return (
    <Popover
      portal
      placement="bottom-end"
      width={272}
      aria-label={t('{bot} 的上下文', { bot })}
      trigger={
        <button
          type="button"
          className="ctx-meter"
          data-level={level}
          aria-label={t('{bot} 上下文 {detail}', { bot, detail })}
          title={[t('上下文 {detail}', { detail }), compact].filter(Boolean).join(' · ')}
        >
          <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true">
            <circle className="ctx-meter__track" cx={7} cy={7} r={R} />
            <circle
              className="ctx-meter__arc"
              cx={7}
              cy={7}
              r={R}
              strokeDasharray={`${(pct / 100) * ARC} ${ARC}`}
              transform="rotate(-90 7 7)"
            />
            {compact ? (
              <circle
                className="ctx-meter__mark"
                cx={7 + R * Math.cos(angle)}
                cy={7 + R * Math.sin(angle)}
                r={1.4}
              />
            ) : null}
          </svg>
          {pct}%
        </button>
      }
    >
      {(close) => (
        <div className="ctx-pop">
          <LevelIndicator
            value={pct}
            warning={WARNING}
            critical={CRITICAL}
            aria-label={t('上下文占用')}
            label={
              <>
                <span>{t('上下文')}</span>
                <span className="ctx-pop__detail">{detail}</span>
              </>
            }
          />
          <p className="ctx-pop__hint">
            {context.compactAt ? t('约在 {n} 时自动压缩。', { n: fmtTokens(context.compactAt) }) : null}
            {level === 'critical' ? t('即将用满，Agent 会自动压缩。') : null}
            {t('压缩会把此前的对话总结后保留；开新对话则不再带上此前的对话。')}
          </p>
          <div className="ctx-pop__actions">
            <Button
              size="small"
              variant="plain"
              onClick={() => {
                close()
                send('new')
              }}
            >
              {t('开新对话')}
            </Button>
            <Button
              size="small"
              variant="primary"
              onClick={() => {
                close()
                send('compact')
              }}
            >
              {t('压缩上下文')}
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}
