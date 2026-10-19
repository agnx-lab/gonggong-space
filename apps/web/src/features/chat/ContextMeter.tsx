import type { ContextUsage } from '@gonggong/protocol'
import { useState } from 'react'
import { t } from '../../i18n'
import { cx } from '../../lib/cx'
import { toastError } from '../../lib/errors'
import { fmtTokens } from '../../lib/format'
import { Button, LevelIndicator, Popover, TextField } from '../../ui'
import { postMessage, uuid } from './MessageComposer'

const R = 5
const ARC = 2 * Math.PI * R
/** Claude Code warns this far before its compaction point. */
const MARGIN = 20_000

/** Token counts where the meter turns orange and red: before the agent's own compaction or stop, else by share. */
function thresholds({ size, compactAt, blockAt }: ContextUsage): { warning: number; critical?: number } {
  if (compactAt) return { warning: compactAt - MARGIN }
  if (blockAt) return { warning: blockAt - 2 * MARGIN, critical: blockAt - MARGIN }
  return { warning: size * 0.7, critical: size * 0.9 }
}

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
  const [keep, setKeep] = useState('')
  const size = Math.max(1, context.size)
  const pct = Math.min(100, Math.round((context.used / size) * 100))
  const { warning, critical } = thresholds(context)
  const level =
    critical != null && context.used >= critical ? 'critical' : context.used >= warning ? 'warning' : 'normal'
  const detail = `${fmtTokens(context.used)} / ${fmtTokens(context.size)}`
  const mark = context.compactAt ?? context.blockAt
  const left = context.compactAt ? fmtTokens(Math.max(0, context.compactAt - context.used)) : null
  // Where the compaction (or stop) point sits on the ring, clockwise from the top.
  const angle = mark ? (Math.min(1, mark / size) - 0.25) * 2 * Math.PI : 0
  const send = (command: string) =>
    postMessage(groupId, {
      body: `/${command} @${bot}`,
      clientId: uuid(),
      attachmentIds: [],
      quote: null,
      appendTo: null,
    }).catch(toastError)
  const compact = (close: () => void) => {
    close()
    const text = keep.replace(/\s+/g, ' ').trim()
    setKeep('')
    send(text ? `compact ${text}` : 'compact')
  }
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
          title={[t('上下文 {detail}', { detail }), left && t('还剩 {n} 自动压缩', { n: left })]
            .filter(Boolean)
            .join(' · ')}
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
            {mark ? (
              <circle
                className={cx('ctx-meter__mark', !context.compactAt && 'ctx-meter__mark--block')}
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
            warning={(warning / size) * 100}
            critical={critical == null ? undefined : (critical / size) * 100}
            aria-label={t('上下文占用')}
            label={
              <>
                <span>{t('上下文')}</span>
                <span className="ctx-pop__detail">{detail}</span>
              </>
            }
          />
          <p className="ctx-pop__hint">
            {left ? t('还剩 {n} 自动压缩。', { n: left }) : null}
            {context.blockAt
              ? t('已关闭自动压缩，用到 {n} 时 Agent 会停下，需要手动压缩或开新对话。', {
                  n: fmtTokens(context.blockAt),
                })
              : null}
            {level === 'critical' ? (context.blockAt ? t('即将停下。') : t('即将用满。')) : null}
            {t('压缩会把此前的对话总结后保留；开新对话则不再带上此前的对话。')}
          </p>
          <TextField
            size="regular"
            aria-label={t('压缩时保留的重点（可选）')}
            placeholder={t('压缩时保留的重点（可选）')}
            value={keep}
            maxLength={500}
            onChange={(e) => setKeep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) compact(close)
            }}
          />
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
            <Button size="small" variant="primary" onClick={() => compact(close)}>
              {t('压缩上下文')}
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}
