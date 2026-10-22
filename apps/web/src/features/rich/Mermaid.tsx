import { type ReactNode, useEffect, useState } from 'react'
import { t } from '../../i18n'
import { useDark } from './theme'

let seq = 0

/** ```mermaid: rendered to SVG by mermaid (fetched on first use, strict: no scripts or click handlers in the source). */
export function Mermaid({ source, fallback }: { source: string; fallback: ReactNode }) {
  const dark = useDark()
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let gone = false
    setFailed(false)
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' })
        // parse first: a failed render() can leave its error diagram in the page.
        await mermaid.parse(source)
        const { svg } = await mermaid.render(`gg-mermaid-${++seq}`, source)
        if (!gone) setSvg(svg)
      })
      .catch(() => !gone && setFailed(true))
    return () => {
      gone = true
    }
  }, [source, dark])
  if (failed)
    return (
      <div className="rich-failed">
        {fallback}
        <span className="rich-failed__hint">{t('图表渲染失败，已显示源码')}</span>
      </div>
    )
  return (
    <div
      className="rich-mermaid"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid's strict mode sanitizes its SVG (DOMPurify)
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  )
}
