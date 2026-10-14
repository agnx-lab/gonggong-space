import { createContext, isValidElement, memo, type ReactNode, useContext, useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { t } from '../../i18n'
import { CodeBlock, splitMentions, toast } from '../../ui'

const copyFailed = () => toast({ type: 'error', message: t('复制失败') })

/** Fenced code: the single `<code>` child of `<pre>`, its language from `language-*`. */
function fenced(children: ReactNode) {
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children.props : null
  const text = String(code?.children ?? '').replace(/\n$/, '')
  const language = /language-([\w+-]+)/.exec(code?.className ?? '')?.[1]
  return { text, language }
}

interface MdNode {
  type: string
  url?: string
  value?: string
  children?: MdNode[]
  data?: { hName: string; hProperties: Record<string, unknown> }
}

/** CJK text and full-width punctuation: GFM only ends a bare URL at whitespace, so `（http://x）。然后` would swallow them. */
const CJK = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/

/** Cuts literal autolinks (link text = end of its url) at the first CJK character, which goes back to plain text. */
function trimAutolinks(node: MdNode) {
  const kids = node.children
  if (!kids) return
  for (let i = 0; i < kids.length; i++) {
    const link = kids[i]
    const text = link?.children?.length === 1 ? link.children[0] : undefined
    const at = text?.type === 'text' ? (text.value ?? '').search(CJK) : -1
    if (link?.type !== 'link' || !text?.value || !link.url?.endsWith(text.value) || at < 0) {
      if (link) trimAutolinks(link)
      continue
    }
    const rest = text.value.slice(at)
    link.url = link.url.slice(0, -rest.length)
    text.value = text.value.slice(0, at)
    kids.splice(i + 1, 0, { type: 'text', value: rest })
  }
}

const remarkPlugins = [remarkGfm, () => trimAutolinks]

/** Names a reply may @ in this chat; without it (files, process view) an @ is plain text. */
interface Names {
  members: string[]
  bots: string[]
  me?: string
}
export const MentionNames = createContext<Names | null>(null)

/**
 * Bot reply @s: members highlight like in members' messages; bots grey, since a reply's @ never starts a bot (only
 * hand_off does). Text nodes only, so code is skipped; links keep their own text.
 */
function remarkMentions({ members, bots, me }: Names) {
  const isBot = new Set(bots)
  const names = [...bots, ...members]
  const mention = (name: string): MdNode => ({
    type: 'mention',
    data: {
      hName: 'span',
      hProperties: isBot.has(name)
        ? { className: ['pn-mention', 'pn-mention--bot'], title: t('仅提及，不会让 Bot 开始工作') }
        : { className: name === me ? ['pn-mention', 'pn-mention--me'] : ['pn-mention'] },
    },
    children: [{ type: 'text', value: `@${name}` }],
  })
  const visit = (node: MdNode) => {
    if (!node.children || node.type === 'link' || node.type === 'linkReference') return
    node.children = node.children.flatMap((c) => {
      if (c.type !== 'text') {
        visit(c)
        return [c]
      }
      return splitMentions(c.value ?? '', names).map((s) =>
        s.mention ? mention(s.text.slice(1)) : { type: 'text', value: s.text },
      )
    })
  }
  return () => visit
}

const components: Components = {
  pre: ({ children }) => {
    const { text, language } = fenced(children)
    return <CodeBlock code={text} language={language} onCopyError={copyFailed} />
  },
  table: ({ node: _node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
}

/** Bot reply rendering: GFM (tables, task lists) + Pane code blocks with copy. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const names = useContext(MentionNames)
  const plugins = useMemo(() => (names ? [...remarkPlugins, remarkMentions(names)] : remarkPlugins), [names])
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
