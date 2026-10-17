import type { AgentSettingField } from '@gonggong/protocol'
import { useState } from 'react'
import { t } from '../../i18n'
import { Button, Checkbox, Divider, FormRow, PopUpButton, SegmentedControl, Tag, TextField } from '../../ui'
import { BOOL_RAW, type BoolState, boolState, fieldLabel, tokensLabel, valueLabel } from './agentSettings'

const GROUPS: { title: string; ids: string[] }[] = [
  { title: t('上下文'), ids: ['contextWindow', 'autoCompactWindow', 'maxOutputTokens'] },
  { title: t('请求'), ids: ['disableThinking', 'disableBetas', 'toolSearch', 'apiTimeout'] },
]

export const BOOL_ITEMS: { value: BoolState; label: string }[] = [
  { value: 'default', label: t('默认') },
  { value: 'on', label: t('开') },
  { value: 'off', label: t('关') },
]

const PLACEHOLDER: Record<AgentSettingField['type'], string> = {
  tokens: t('默认，如 128k'),
  ms: t('默认，如 10m、600s'),
  flag: '',
  bool: '',
  text: t('默认'),
  enum: '',
}

/** What a text means for display: 默认 when empty, 开 / 关 for switches. */
const shown = (f: AgentSettingField, text: string) =>
  !text ? t('默认') : f.type === 'tokens' || f.type === 'ms' ? text : valueLabel(f, text)

/**
 * Provider-layer settings of a provider or the official login, grouped, in place of raw variables. `texts` are what the
 * controls show (agentSettings `textOf`); `preset` the preset's, for 已修改 / 恢复预设; `modelWindow` the selected
 * model's window, shown while the provider sets none.
 */
export function ProviderSettingRows({
  fields,
  texts,
  preset,
  modelWindow,
  onChange,
  onRestore,
}: {
  fields: readonly AgentSettingField[]
  texts: Record<string, string>
  preset?: Record<string, string> | null
  modelWindow?: number
  onChange: (id: string, text: string) => void
  onRestore?: (id: string) => void
}) {
  return GROUPS.map((g) => {
    const list = fields.filter((f) => g.ids.includes(f.id))
    if (!list.length) return null
    return [
      <Divider key={g.title} label={g.title} />,
      ...list.map((f) => {
        const text = texts[f.id] ?? ''
        const label = fieldLabel(f.id)
        const presetText = preset?.[f.id] ?? ''
        const hint = preset ? (
          <span className="mx-inline mx-preset">
            <span>{t('预设：{v}', { v: shown(f, presetText) })}</span>
            {text !== presetText ? (
              <>
                <Tag tone="orange">{t('已修改')}</Tag>
                <Button
                  size="small"
                  variant="plain"
                  aria-label={t('恢复预设：{label}', { label })}
                  onClick={() => onRestore?.(f.id)}
                >
                  {t('恢复预设')}
                </Button>
              </>
            ) : null}
          </span>
        ) : f.id === 'autoCompactWindow' ? (
          t('{min}–{max}，不超过上下文窗口', {
            min: tokensLabel(f.min ?? 0),
            max: tokensLabel(f.max ?? 0),
          })
        ) : undefined
        const set = (v: string) => onChange(f.id, v)
        if (f.type === 'flag')
          return (
            <FormRow key={f.id} hint={hint}>
              <Checkbox
                label={label}
                checked={!!text && text !== '0'}
                onChange={(on) => set(on ? '1' : '')}
              />
            </FormRow>
          )
        return (
          <FormRow key={f.id} label={label} hint={hint}>
            {f.id === 'contextWindow' ? (
              <WindowControl field={f} text={text} modelWindow={modelWindow} onChange={set} />
            ) : f.type === 'bool' ? (
              <SegmentedControl<BoolState>
                aria-label={label}
                size="small"
                value={boolState(text)}
                onChange={(v) => set(BOOL_RAW[v])}
                items={BOOL_ITEMS}
              />
            ) : (
              <TextField
                aria-label={label}
                value={text}
                placeholder={f.id === 'autoCompactWindow' ? t('跟随上下文窗口') : PLACEHOLDER[f.type]}
                onChange={(e) => set(e.target.value)}
              />
            )}
          </FormRow>
        )
      }),
    ]
  })
}

const DEFAULT = '__default'
const CUSTOM = '__custom'

/** 默认（按模型：256K） / the listed windows / 自定义 with a typed value (`256k`, `1m`). */
function WindowControl({
  field,
  text,
  modelWindow,
  onChange,
}: {
  field: AgentSettingField
  text: string
  modelWindow?: number
  onChange: (text: string) => void
}) {
  const labels = (field.options ?? []).map((o) => tokensLabel(Number(o)))
  const [picked, setPicked] = useState(false)
  const custom = picked || (!!text && !labels.includes(text))
  const value = custom ? CUSTOM : text ? text : DEFAULT
  const label = fieldLabel(field.id)
  return (
    <span className="mx-inline mx-field-row">
      <PopUpButton<string>
        aria-label={label}
        value={value}
        onChange={(v) => {
          setPicked(v === CUSTOM)
          if (v !== CUSTOM) onChange(v === DEFAULT ? '' : v)
        }}
        options={[
          {
            value: DEFAULT,
            label: modelWindow ? t('按模型：{n}', { n: tokensLabel(modelWindow) }) : t('默认'),
          },
          ...labels.map((l) => ({ value: l, label: l })),
          { value: CUSTOM, label: t('自定义') },
        ]}
      />
      {custom ? (
        <TextField
          aria-label={t('自定义{label}', { label })}
          value={text}
          placeholder={t('如 256k、1m')}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </span>
  )
}
