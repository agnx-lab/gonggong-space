import type { SecretDto } from '@gonggong/protocol'
import { t } from '../../i18n'
import { Button, ComboBox, IconButton, TextField } from '../../ui'
import { SCOPE_LABEL } from '../secrets/api'

export type Pair = { key: string; value: string }

/** An MCP env / header value: a whole `${secret:NAME}` reference, never plain text (the server rejects it too). */
export const SECRET_REF = /^\$\{secret:[A-Z][A-Z0-9_]{1,63}\}$/

/** `${secret:NAME}`. */
export const secretRef = (name: string) => `\${secret:${name}}`

/** Env vars (stdio) or headers (http) of an MCP server: each value picked from the visible secrets or typed as a reference. */
export function SecretPairs({
  pairs,
  secrets,
  onChange,
}: {
  pairs: Pair[]
  secrets: SecretDto[]
  onChange: (pairs: Pair[]) => void
}) {
  const options = secrets
    .filter((s) => !s.overridden)
    .map((s) => ({ value: secretRef(s.name), label: secretRef(s.name), detail: SCOPE_LABEL[s.scope] }))
  const set = (i: number, patch: Partial<Pair>) =>
    onChange(pairs.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  return (
    <div className="cfg__pairs">
      {pairs.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity until a key is typed
        <div key={i} className="cfg__pair">
          <TextField
            aria-label={t('第 {n} 项的名称', { n: i + 1 })}
            mono
            placeholder="API_TOKEN"
            value={p.key}
            onChange={(e) => set(i, { key: e.target.value })}
          />
          <ComboBox
            aria-label={t('第 {n} 项的值', { n: i + 1 })}
            placeholder={t('选择或输入 {ref}', { ref: secretRef(t('名称')) })}
            options={options}
            value={p.value}
            onInput={(value) => set(i, { value })}
            onChange={(value) => set(i, { value })}
          />
          <IconButton
            title={t('移除第 {n} 项', { n: i + 1 })}
            size="regular"
            onClick={() => onChange(pairs.filter((_, j) => j !== i))}
          >
            {'trash' as const}
          </IconButton>
        </div>
      ))}
      <div className="cfg__foot">
        <span className="gs-desc">
          {t('值只能引用密钥，运行时替换为实值；密钥在本层或团队、群设置的「密钥」里维护。')}
        </span>
        <span className="spacer" />
        <Button size="small" onClick={() => onChange([...pairs, { key: '', value: '' }])}>
          {t('添加一项')}
        </Button>
      </div>
    </div>
  )
}
