import type { BotDto, GroupDto, GroupPluginDto, MessageDto, PluginInput } from '@gonggong/protocol'
import { type ChangeEvent, useRef, useState } from 'react'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { cx } from '../../lib/cx'
import { toastError } from '../../lib/errors'
import {
  Button,
  Dialog,
  EmptyState,
  Form,
  FormRow,
  Icon,
  SegmentedControl,
  Switch,
  Tag,
  TextField,
} from '../../ui'
import { AttachmentChips, useUploads } from '../attachments/ComposerAttachments'
import { BotAvatar } from '../bots/avatars'
import { AGENT_LABEL } from '../bots/model'
import { blockerText, CATEGORY, type CreationDraft, newDraft, previewUrl, requestOf } from './model'
import { PluginTile, Swatches } from './PluginTile'
import { type CreationOpen, closeCreation, createInGroup } from './store'
import './plugins.css'

const STEPS = [t('类型与模板'), t('设计系统'), t('内容与参数'), t('交给谁')]

const blockerOf = (p: GroupPluginDto, botId: string) => p.bots.find((b) => b.botId === botId)?.blocker ?? null

const valueText = (v: string | boolean | undefined) =>
  typeof v === 'boolean' ? (v ? t('是') : t('否')) : (v ?? '').trim()

/** 创作 (prototype #sheet-0~3): type and template → design system → content → bot, with the summary on the right. */
export function CreationSheet({
  group,
  plugins,
  open,
  onSent,
}: {
  group: GroupDto
  plugins: GroupPluginDto[]
  open: CreationOpen
  onSent: (m: MessageDto) => void
}) {
  const allBots = useWorkspace((s) => s.bots)
  const bots = group.botIds.map((id) => allBots.find((b) => b.id === id)).filter((b): b is BotDto => !!b)
  const usableBot = (p: GroupPluginDto) => bots.find((b) => !blockerOf(p, b.id))?.id ?? null
  const [draft, setDraft] = useState<CreationDraft>(() => {
    if (open.draft) return open.draft
    const p = plugins.find((x) => x.id === open.pluginId) ?? (plugins[0] as GroupPluginDto)
    return newDraft(p, usableBot(p))
  })
  const [step, setStep] = useState(open.step ?? 0)
  const [busy, setBusy] = useState(false)
  const uploads = useUploads(group.id)
  const fileInput = useRef<HTMLInputElement>(null)
  const plugin = plugins.find((p) => p.id === draft.pluginId) ?? (plugins[0] as GroupPluginDto)
  const m = plugin.manifest
  const template = m.templates.find((x) => x.id === draft.templateId)
  const ds = m.designSystems.find((x) => x.id === draft.designSystemId)
  const bot = bots.find((b) => b.id === draft.botId)
  const set = (patch: Partial<CreationDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const setInput = (id: string, v: string | boolean) =>
    setDraft((d) => ({ ...d, inputs: { ...d.inputs, [id]: v } }))
  const pickPlugin = (p: GroupPluginDto) => {
    if (p.id === draft.pluginId) return
    const keep = draft.botId && !blockerOf(p, draft.botId) ? draft.botId : usableBot(p)
    setDraft(newDraft(p, keep))
  }

  const filled = m.inputs.flatMap((i) => {
    const v = valueText(draft.inputs[i.id])
    return v ? [{ label: i.label, value: v }] : []
  })
  const blocker = bot ? blockerOf(plugin, bot.id) : null
  const problems = [
    ...m.inputs
      .filter((i) => i.required && !valueText(draft.inputs[i.id]))
      .map((i) => t('请填写{label}', { label: i.label })),
    ...(!bot
      ? [t('请选择交给哪个 Bot')]
      : blocker
        ? [`${bot.name}：${blockerText(blocker, m, bot.name)}`]
        : []),
  ]

  const submit = async () => {
    const req = requestOf(draft, uploads.ids)
    if (!req) return
    setBusy(true)
    try {
      onSent(await createInGroup(group.id, req))
      closeCreation()
    } catch (e) {
      toastError(e)
      setBusy(false)
    }
  }

  const subtitles = [
    [m.title, template?.title].filter(Boolean).join(' · '),
    ds?.title ?? '—',
    filled.find((f) => m.inputs.find((i) => i.label === f.label)?.type !== 'select')?.value ?? '—',
    bot?.name ?? t('未选'),
  ]
  const last = step === STEPS.length - 1

  return (
    <Dialog
      open
      width={940}
      title={t('创作')}
      message={t('选好以后由 AI 一键完成，结果发到本群')}
      onClose={closeCreation}
      closeOnBackdrop={false}
      footer={<span className="plg-sheet__count">{`${step + 1} / ${STEPS.length}`}</span>}
      actions={[
        { label: t('取消'), onClick: closeCreation },
        ...(step > 0 ? [{ label: t('上一步'), onClick: () => setStep(step - 1) }] : []),
        last
          ? {
              label: t('交给 AI'),
              variant: 'primary' as const,
              disabled: busy || problems.length > 0 || uploads.uploading,
              onClick: () => void submit(),
            }
          : { label: t('下一步'), variant: 'primary' as const, onClick: () => setStep(step + 1) },
      ]}
    >
      <div className="plg-sheet">
        <nav className="plg-steps" aria-label={t('步骤')}>
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={cx('plg-step', i === step && 'plg-step--on')}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => setStep(i)}
            >
              <span className={cx('plg-step__n', i < step && 'plg-step__n--done')}>
                {i < step ? <Icon name="check" size={10} /> : i + 1}
              </span>
              <span className="plg-step__text">
                <span>{label}</span>
                <span className="plg-step__sub">{subtitles[i]}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="plg-pane">
          {step === 0 ? (
            <>
              <section>
                <h3 className="plg-heading">{t('做什么')}</h3>
                <div className="gs-note">
                  {t('只显示本群已启用的插件。还想要别的类型，请群管理员到群设置里启用。')}
                </div>
                <div className="plg-chips">
                  {plugins.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="plg-chip"
                      aria-pressed={p.id === plugin.id}
                      onClick={() => pickPlugin(p)}
                    >
                      <PluginTile m={p.manifest} size={20} />
                      {p.manifest.title}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="plg-heading">{t('选一个模板')}</h3>
                <div className="gs-note">
                  {t('{desc} · {n} 个模板', { desc: m.description, n: m.templates.length })}
                </div>
                <div className="plg-grid plg-grid--tpl">
                  {m.templates.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      className="plg-card"
                      aria-pressed={tp.id === draft.templateId}
                      onClick={() => set({ templateId: tp.id })}
                    >
                      <span className="plg-card__check" aria-hidden="true">
                        <Icon name="check" size={10} />
                      </span>
                      {tp.preview ? (
                        <img
                          className="plg-card__thumb"
                          src={previewUrl(plugin.id, tp.preview)}
                          alt={tp.title}
                        />
                      ) : (
                        <span
                          className="plg-card__thumb plg-card__thumb--none"
                          style={{ background: CATEGORY[m.category].color }}
                        >
                          <Icon name={CATEGORY[m.category].icon} size={22} />
                        </span>
                      )}
                      <b>{tp.title}</b>
                      <span className="plg-card__desc">{tp.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : step === 1 ? (
            <section>
              <h3 className="plg-heading">{t('设计系统')}</h3>
              <div className="gs-note">{t('决定颜色、字体和组件样式，只对这一次创作生效。')}</div>
              {m.designSystems.length ? (
                <div className="plg-grid">
                  {m.designSystems.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="plg-card"
                      aria-pressed={d.id === draft.designSystemId}
                      onClick={() => set({ designSystemId: d.id })}
                    >
                      <span className="plg-card__check" aria-hidden="true">
                        <Icon name="check" size={10} />
                      </span>
                      <Swatches colors={d.swatches} />
                      <b>{d.title}</b>
                      <span className="plg-card__desc">{d.description}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState compact icon="appearance" title={t('这个插件没有设计系统，由 AI 自由发挥')} />
              )}
            </section>
          ) : step === 2 ? (
            <section>
              <h3 className="plg-heading">{t('内容与参数')}</h3>
              <div className="gs-note">{t('表单根据插件声明的输入项自动生成。')}</div>
              <Form className="plg-form">
                {m.inputs.map((i) => (
                  <FormRow key={i.id} label={i.label} align={i.type === 'text' ? 'top' : 'center'}>
                    <InputField input={i} value={draft.inputs[i.id]} onChange={(v) => setInput(i.id, v)} />
                  </FormRow>
                ))}
                <FormRow label={t('参考资料')} align="top">
                  <div className="plg-files">
                    <Button size="small" icon="paperclip" onClick={() => fileInput.current?.click()}>
                      {t('添加附件…')}
                    </Button>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      hidden
                      aria-label={t('添加附件')}
                      onChange={(e) => {
                        uploads.add([...(e.target.files ?? [])])
                        e.target.value = ''
                      }}
                    />
                    <AttachmentChips uploads={uploads} />
                  </div>
                </FormRow>
                <FormRow label={t('视觉方向')}>
                  <Switch
                    ariaLabel={t('视觉方向')}
                    checked={draft.directions}
                    onChange={(directions) => set({ directions })}
                    labelPosition="after"
                    label={t('先出 2–3 个方向草图，在群里选定后再做完整稿（多一轮生成）')}
                  />
                </FormRow>
              </Form>
            </section>
          ) : (
            <section>
              <h3 className="plg-heading">{t('交给谁')}</h3>
              <div className="gs-note">
                {t('列出本群的 Bot。只能选在线、并且能用这个插件的 Bot；不能用的会写明原因。')}
              </div>
              <div className="plg-bots" role="radiogroup" aria-label={t('交给谁')}>
                {bots.map((b) => {
                  const why = blockerOf(plugin, b.id)
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: a bot row with avatar and reason, not a bare radio input
                    <button
                      key={b.id}
                      type="button"
                      role="radio"
                      aria-checked={b.id === draft.botId}
                      aria-disabled={why ? true : undefined}
                      className={cx('plg-botrow', why && 'plg-botrow--off')}
                      onClick={() => (why ? undefined : set({ botId: b.id }))}
                    >
                      <BotAvatar id={b.id} name={b.name} size={28} />
                      <span className="plg-botrow__text">
                        <span className="plg-botrow__name">
                          <b>{b.name}</b>
                          <Tag tone="gray">{AGENT_LABEL[b.agentKind]}</Tag>
                        </span>
                        <span className="plg-botrow__sub">
                          {why
                            ? `⚠ ${blockerText(why, m, b.name)} · ${t('主人 {name}', { name: b.ownerName })}`
                            : `${t('在线 · 支持该插件')} · ${t('主人 {name}', { name: b.ownerName })}`}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
        <aside className="plg-side">
          <h4 className="plg-side__title">{t('将交给 AI 的内容')}</h4>
          <section className="plg-side__box" aria-label={t('将交给 AI 的内容')}>
            <div>
              {t('插件')} <code>{`${m.name} ${m.version}`}</code>
            </div>
            {template ? <div>{t('模板：{title}', { title: template.title })}</div> : null}
            {ds ? <div>{t('设计系统：{title}', { title: ds.title })}</div> : null}
            {filled.map((f) => (
              <div key={f.label}>{`${f.label}：${f.value}`}</div>
            ))}
            {draft.directions ? <div>{t('先出视觉方向：是')}</div> : null}
            {uploads.items.length ? <div>{t('参考附件：{n} 个', { n: uploads.items.length })}</div> : null}
          </section>
          <h4 className="plg-side__title">{t('发出后群里会看到')}</h4>
          <div className="plg-side__box">
            {t('一张「创作请求」卡片，并自动 @{bot}。群成员都能看到参数，也可以「再来一版」。', {
              bot: bot?.name ?? '…',
            })}
          </div>
          <h4 className="plg-side__title">{t('检查')}</h4>
          <div className={cx('plg-check', problems.length ? 'plg-check--warn' : 'plg-check--ok')}>
            {problems.length ? (
              problems.map((p) => (
                <div key={p} className="plg-check__item">
                  <span aria-hidden="true">⚠</span>
                  <span>{p}</span>
                </div>
              ))
            ) : (
              <div className="plg-check__item">
                <span aria-hidden="true">✓</span>
                <span>{t('可以开始：Bot 在线，插件可用，密钥齐全')}</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Dialog>
  )
}

function InputField({
  input: i,
  value,
  onChange,
}: {
  input: PluginInput
  value: string | boolean | undefined
  onChange: (v: string | boolean) => void
}) {
  if (i.type === 'boolean')
    return <Switch ariaLabel={i.label} checked={value === true} onChange={(v) => onChange(v)} />
  if (i.type === 'select')
    return (
      <SegmentedControl
        aria-label={i.label}
        size="small"
        items={i.options.map((o) => ({ value: o, label: o }))}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
      />
    )
  return (
    <TextField
      aria-label={i.label}
      multiline={i.type === 'text'}
      rows={i.type === 'text' ? 3 : undefined}
      placeholder={i.placeholder ?? undefined}
      value={typeof value === 'string' ? value : ''}
      onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
    />
  )
}
