import { randomBytes } from 'node:crypto'

/** Names carry their creation time, so a run can drop what killed runs left behind without touching live ones. */
export const testDbName = (kind: 't' | 'tpl', now = Date.now()) =>
  `gonggong_${kind}_${now}_${randomBytes(4).toString('hex')}`

export function staleTestDbs(names: string[], now = Date.now(), maxAgeMs = 3_600_000) {
  return names.filter((name) => {
    const created = /^gonggong_(?:t|tpl)_(\d+)_[0-9a-f]+$/.exec(name)?.[1]
    return created !== undefined && now - Number(created) > maxAgeMs
  })
}
