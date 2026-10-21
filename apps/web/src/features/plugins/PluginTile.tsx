import type { PluginManifest } from '@gonggong/protocol'
import { cx } from '../../lib/cx'
import { Icon } from '../../ui'
import { CATEGORY } from './model'
import './plugins.css'

export function PluginTile({ m, size = 32 }: { m: Pick<PluginManifest, 'category'>; size?: number }) {
  const c = CATEGORY[m.category]
  return (
    <span className="plg-tile" style={{ background: c.color, width: size, height: size }} aria-hidden="true">
      <Icon name={c.icon} size={Math.round(size * 0.5)} />
    </span>
  )
}

export function Swatches({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span className={cx('plg-swatch', className)} aria-hidden="true">
      {colors.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: colours may repeat
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  )
}
