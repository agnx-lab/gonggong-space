import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../../i18n'
import { errorText } from '../../lib/api'
import { Button, Icon, toast } from '../../ui'
import { postMessage, uuid } from '../chat/MessageComposer'
import { RichMessage } from './context'

/** No network: the page can only use what it carries inline. */
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:"
/** `window.gg` for the page; it also reports the page's height whenever it changes. */
const BRIDGE = `<script>window.gg={resize:function(h){parent.postMessage({gg:'resize',height:Number(h)},'*')},reply:function(t){parent.postMessage({gg:'reply',text:String(t)},'*')}};new ResizeObserver(function(){gg.resize(Math.ceil(document.documentElement.getBoundingClientRect().height))}).observe(document.documentElement)</script>`

/** The frame's document: CSP and bridge first, so they apply before any of the page's own markup. */
export const widgetDoc = (html: string) =>
  `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}">${BRIDGE}${html.replace(/^\s*<!doctype[^>]*>/i, '')}`

const MIN_HEIGHT = 80
const MAX_HEIGHT = 800
const REPLY_MAX = 2000

/**
 * ```widget: the bot's own HTML page in a script-only sandbox (opaque origin: no cookies, storage or access to this
 * page), folded until opened. gg.reply(text) asks to send `@bot text` quoting the reply as me; it only goes out when
 * I confirm here, since anything inside the frame, clicks included, can be forged by the page.
 */
export function Widget({ html }: { html: string }) {
  const message = useContext(RichMessage)
  const frame = useRef<HTMLIFrameElement>(null)
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(360)
  const [ask, setAsk] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const doc = useMemo(() => widgetDoc(html), [html])

  useEffect(() => {
    if (!open) return
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return
      const d = e.data as { gg?: unknown; height?: unknown; text?: unknown } | null
      if (d?.gg === 'resize' && typeof d.height === 'number' && Number.isFinite(d.height))
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(d.height))))
      else if (d?.gg === 'reply' && typeof d.text === 'string' && d.text.trim() && message)
        setAsk(d.text.trim().slice(0, REPLY_MAX))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open, message])

  if (!open)
    return (
      <button type="button" className="rich-widget rich-widget--folded" onClick={() => setOpen(true)}>
        {t('🧩 交互页面 · 点击展开')}
      </button>
    )

  const send = async () => {
    if (!message || ask === null) return
    setSending(true)
    try {
      await postMessage(message.groupId, {
        body: `@${message.authorName} ${ask}`,
        clientId: uuid(),
        attachmentIds: [],
        quote: { kind: 'message', id: message.id },
        appendTo: null,
      })
      setAsk(null)
    } catch (e) {
      toast({ type: 'error', message: errorText(e) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rich-widget">
      <div className="rich-widget__head">
        <span>{t('交互页面')}</span>
        <Button size="small" variant="plain" onClick={() => setOpen(false)}>
          {t('收起')}
        </Button>
      </div>
      <iframe
        ref={frame}
        className="rich-widget__frame"
        title={t('交互页面')}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        srcDoc={doc}
        style={{ height }}
      />
      {ask === null ? null : (
        <div className="rich-widget__ask" role="alert">
          <Icon name="send" size={14} />
          <span className="rich-widget__ask-text">
            {t('页面请求以你的身份发给 {bot}：', { bot: message?.authorName ?? '' })}
            <q>{ask}</q>
          </span>
          <Button size="small" variant="plain" disabled={sending} onClick={() => setAsk(null)}>
            {t('取消')}
          </Button>
          <Button size="small" variant="primary" loading={sending} onClick={send}>
            {t('发送')}
          </Button>
        </div>
      )}
    </div>
  )
}
