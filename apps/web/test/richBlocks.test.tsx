import type { MessageDto } from '@gonggong/protocol'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from '../src/features/chat/Markdown'
import { RichMessage } from '../src/features/rich/context'
import { useToasts } from '../src/ui'
import { apiError, mockApi } from './mockApi'

const chart = { init: vi.fn(), setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
vi.mock('../src/features/rich/echarts', () => ({
  init: (...a: unknown[]) => {
    chart.init(...a)
    return chart
  },
}))
const mermaid = { initialize: vi.fn(), parse: vi.fn(), render: vi.fn() }
vi.mock('mermaid', () => ({ default: mermaid }))

const fence = (lang: string, body: unknown) =>
  `前文\n\n\`\`\`${lang}\n${typeof body === 'string' ? body : JSON.stringify(body)}\n\`\`\`\n\n后文`

const reply = (o: Partial<MessageDto> = {}): MessageDto => ({
  id: 'm1',
  seq: 1,
  groupId: 'g1',
  kind: 'bot',
  authorId: 'b1',
  authorName: '小助手',
  body: '',
  mentions: [],
  runId: null,
  createdAt: new Date().toISOString(),
  attachments: [],
  quote: null,
  ...o,
})

const inReply = (text: string, m: MessageDto = reply({ body: text })) =>
  render(
    <RichMessage.Provider value={m}>
      <Markdown text={text} botId="b1" />
    </RichMessage.Provider>,
  )

/** A plain code block (the fallback): its header names the language and its text is the source. */
const codeBlock = (lang: string) => screen.getByText(lang, { selector: '.pn-code__head span' })

beforeEach(() => {
  vi.clearAllMocks()
  useToasts.setState({ items: [] })
  document.documentElement.dataset.theme = 'light'
})
afterEach(() => vi.unstubAllGlobals())

describe('chart', () => {
  const line = { type: 'line', title: '日活', x: ['周一', '周二'], series: [{ name: 'DAU', data: [3, 5] }] }

  it('renders a valid block with ECharts: categories on x, one series each', async () => {
    render(<Markdown text={fence('chart', line)} />)
    expect(screen.getByRole('img', { name: '日活' })).toBeTruthy()
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled())
    const option = chart.setOption.mock.calls[0]?.[0]
    expect(option.xAxis.data).toEqual(['周一', '周二'])
    expect(option.series).toMatchObject([{ type: 'line', name: 'DAU', data: [3, 5] }])
    expect(option.tooltip.trigger).toBe('axis')
  })

  it('follows the dark theme and redraws when it switches', async () => {
    render(<Markdown text={fence('chart', line)} />)
    await waitFor(() => expect(chart.init).toHaveBeenCalledTimes(1))
    expect(chart.init.mock.calls[0]?.[1]).toBeUndefined()
    act(() => {
      document.documentElement.dataset.theme = 'dark'
    })
    await waitFor(() => expect(chart.init).toHaveBeenCalledTimes(2))
    expect(chart.dispose).toHaveBeenCalledTimes(1)
    expect(chart.init.mock.calls[1]?.[1]).toBe('dark')
  })

  it('pie: x names the slices, series[0] gives their values', async () => {
    render(
      <Markdown
        text={fence('chart', { type: 'pie', x: ['A', 'B'], series: [{ name: '占比', data: [1, 2] }] })}
      />,
    )
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled())
    const option = chart.setOption.mock.calls[0]?.[0]
    expect(option.series[0]).toMatchObject({
      type: 'pie',
      data: [
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
      ],
    })
    expect(option.tooltip.trigger).toBe('item')
  })

  it('area and stacked map to filled lines on one stack', async () => {
    const area = { type: 'area', stacked: true, x: [1, 2], series: [{ name: 'a', data: [1, null] }] }
    render(<Markdown text={fence('chart', area)} />)
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled())
    expect(chart.setOption.mock.calls[0]?.[0].series[0]).toMatchObject({ type: 'line', stack: 'total' })
    expect(chart.setOption.mock.calls[0]?.[0].series[0].areaStyle).toBeTruthy()
  })

  it('falls back to the code block when the JSON is invalid', () => {
    render(<Markdown text={fence('chart', '{"type":"radar"}')} />)
    expect(codeBlock('chart')).toBeTruthy()
    expect(screen.getByText('{"type":"radar"}')).toBeTruthy()
    expect(chart.init).not.toHaveBeenCalled()
  })

  it('does not mount while the fence is still open (streaming)', async () => {
    const open = `看图：\n\n\`\`\`chart\n${JSON.stringify(line)}`
    const { rerender } = render(<Markdown text={open} />)
    expect(codeBlock('chart')).toBeTruthy()
    await act(async () => {})
    expect(chart.init).not.toHaveBeenCalled()
    rerender(<Markdown text={`${open}\n\`\`\``} />)
    await waitFor(() => expect(chart.init).toHaveBeenCalled())
  })

  it('a fence closed by a shorter run of backticks is still open', async () => {
    render(<Markdown text={`\`\`\`\`chart\n${JSON.stringify(line)}\n\`\`\``} />)
    expect(codeBlock('chart')).toBeTruthy()
    await act(async () => {})
    expect(chart.init).not.toHaveBeenCalled()
  })
})

describe('metrics', () => {
  it('shows each tile with a signed, toned delta and a sparkline for the trend', () => {
    const { container } = render(
      <Markdown
        text={fence('metrics', [
          { label: '收入', value: 1200, unit: '元', delta: 3.2, tone: 'good', trend: [1, 2, 3] },
          { label: '退款率', value: '1.5%', delta: -0.4, tone: 'bad' },
        ])}
      />,
    )
    expect(screen.getByText('收入')).toBeTruthy()
    expect(screen.getByText('1200')).toBeTruthy()
    expect(screen.getByText('+3.2').closest('[data-tone]')?.getAttribute('data-tone')).toBe('good')
    expect(screen.getByText('-0.4').closest('[data-tone]')?.getAttribute('data-tone')).toBe('bad')
    expect(container.querySelectorAll('.ui-spark')).toHaveLength(1)
  })

  it('falls back to the code block when invalid', () => {
    render(<Markdown text={fence('metrics', [])} />)
    expect(codeBlock('metrics')).toBeTruthy()
  })
})

describe('timeline', () => {
  it('lists the entries with their status', () => {
    render(
      <Markdown
        text={fence('timeline', [
          { time: '10:00', title: '构建', status: 'done' },
          { time: '10:05', title: '部署', detail: '灰度 10%', status: 'running' },
        ])}
      />,
    )
    expect(screen.getByText('构建').closest('li')?.getAttribute('data-status')).toBe('done')
    expect(screen.getByText('灰度 10%')).toBeTruthy()
  })

  it('falls back to the code block when invalid', () => {
    render(<Markdown text={fence('timeline', [{ time: '1' }])} />)
    expect(codeBlock('timeline')).toBeTruthy()
  })
})

describe('mermaid', () => {
  it('renders strictly, themed after the app', async () => {
    document.documentElement.dataset.theme = 'dark'
    mermaid.parse.mockResolvedValue({})
    mermaid.render.mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' })
    render(<Markdown text={fence('mermaid', 'graph TD\nA-->B')} />)
    expect(await screen.findByTestId('diagram')).toBeTruthy()
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' }),
    )
    expect(mermaid.render.mock.calls[0]?.[1]).toBe('graph TD\nA-->B')
  })

  it('shows the source with a hint when it cannot render', async () => {
    mermaid.parse.mockRejectedValue(new Error('Parse error'))
    render(<Markdown text={fence('mermaid', 'graph ??')} />)
    expect(await screen.findByText('图表渲染失败，已显示源码')).toBeTruthy()
    expect(codeBlock('mermaid')).toBeTruthy()
    expect(mermaid.render).not.toHaveBeenCalled()
  })
})

describe('actions', () => {
  const block = {
    id: 'pick',
    prompt: '选哪个方案？',
    options: [{ label: 'A' }, { label: 'B', style: 'primary' }, { label: '放弃', style: 'danger' }],
  }
  const text = fence('actions', block)

  it('a click answers the block as me and shows who chose what', async () => {
    const answered = reply({
      body: text,
      actions: { pick: { userId: 'u1', name: '王磊', labels: ['B'], at: new Date().toISOString() } },
    })
    const calls = mockApi({ 'POST /messages/m1/actions': answered })
    inReply(text)
    expect(screen.getByText('选哪个方案？')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({ method: 'POST', body: { blockId: 'pick', options: [1] } })
  })

  it('an answered block is read-only and says who chose', () => {
    const m = reply({
      body: text,
      actions: { pick: { userId: 'u2', name: '李建国', labels: ['A'], at: new Date().toISOString() } },
    })
    inReply(text, m)
    expect(screen.getByText('李建国 已选择 A')).toBeTruthy()
    for (const name of ['A', 'B', '放弃'])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('409 says someone answered first', async () => {
    mockApi({ 'POST /messages/m1/actions': apiError(409, 'conflict', '已作答') })
    inReply(text)
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    await waitFor(() => expect(useToasts.getState().items.map((i) => i.message)).toContain('已有人作答'))
  })

  it('multiple: picks several, then 提交 sends them', async () => {
    const multi = fence('actions', { ...block, multiple: true })
    const calls = mockApi({ 'POST /messages/m1/actions': reply({ body: multi }) })
    inReply(multi)
    const submit = screen.getByRole('button', { name: '提交' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: '放弃' }))
    expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true')
    expect(calls).toHaveLength(0)
    fireEvent.click(submit)
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]?.body).toEqual({ blockId: 'pick', options: [0, 2] })
  })

  it('outside a bot reply the buttons are read-only', () => {
    render(<Markdown text={text} />)
    expect((screen.getByRole('button', { name: 'A' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('falls back to the code block when invalid', () => {
    render(<Markdown text={fence('actions', { options: [] })} />)
    expect(codeBlock('actions')).toBeTruthy()
  })
})

describe('widget', () => {
  const html = '<!DOCTYPE html><html><body><button onclick="gg.reply(\'选 A\')">A</button></body></html>'
  const text = fence('widget', html)
  const open = () => {
    fireEvent.click(screen.getByRole('button', { name: /交互页面/ }))
    return screen.getByTitle('交互页面') as HTMLIFrameElement
  }
  const post = (source: MessageEventSource | null, data: unknown) =>
    act(() => window.dispatchEvent(new MessageEvent('message', { data, source })))

  it('stays folded until opened, then loads in a script-only sandbox under a no-network CSP', () => {
    inReply(text)
    expect(document.querySelector('iframe')).toBeNull()
    const frame = open()
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    const doc = frame.getAttribute('srcdoc') ?? ''
    expect(
      doc.startsWith(
        '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\';',
      ),
    ).toBe(true)
    expect(doc).toContain("script-src 'unsafe-inline'")
    expect(doc).toContain('window.gg')
    expect(doc).toContain('<html><body><button')
    expect(doc).not.toContain('<!DOCTYPE html><html>')
  })

  it('resizes only on messages from its own frame, up to a cap', () => {
    inReply(text)
    const frame = open()
    post(window, { gg: 'resize', height: 500 })
    expect(frame.style.height).not.toBe('500px')
    post(frame.contentWindow, { gg: 'resize', height: 500 })
    expect(frame.style.height).toBe('500px')
    post(frame.contentWindow, { gg: 'resize', height: 5000 })
    expect(frame.style.height).toBe('800px')
  })

  it('a reply needs my click on 发送 and goes out as me, @-ing the bot and quoting the reply', async () => {
    const calls = mockApi({ 'POST /groups/g1/messages': reply({ id: 'm2', kind: 'user' }) })
    inReply(text)
    const frame = open()
    post(window, { gg: 'reply', text: '偷偷发' })
    expect(screen.queryByText(/偷偷发/)).toBeNull()
    post(frame.contentWindow, { gg: 'reply', text: '选 A' })
    expect(calls).toHaveLength(0)
    expect(screen.getByText('选 A')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]?.body).toMatchObject({ body: '@小助手 选 A', quote: { kind: 'message', id: 'm1' } })
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull()
  })

  it('outside a bot reply a reply request is ignored', () => {
    render(<Markdown text={text} />)
    const frame = open()
    post(frame.contentWindow, { gg: 'reply', text: '选 A' })
    expect(screen.queryByRole('button', { name: '发送' })).toBeNull()
  })
})
