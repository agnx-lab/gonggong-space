import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Candidate, CandidatePopover } from '../src/features/chat/ComposerCandidates'

const items = Array.from(
  { length: 12 },
  (_, i) => ({ key: `b${i}`, label: `Bot ${i}`, icon: 'bot', insert: `@Bot${i} ` }) as unknown as Candidate,
)
const sections = [{ label: 'Bot', src: '', items }]

const popover = (active: Candidate | undefined) => (
  <CandidatePopover id="cand" char="@" sections={sections} active={active} onPick={() => {}} />
)

let viewport: { offsetTop: number; addEventListener: () => void; removeEventListener: () => void }
beforeEach(() => {
  viewport = { offsetTop: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('visualViewport', viewport)
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

/** The popover's bottom edge sits at `bottom` in layout coordinates (it opens upward from the composer). */
const placeAt = (bottom: number) =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom } as DOMRect)

describe('CandidatePopover on a short viewport', () => {
  it('fits the room above the composer that the keyboard leaves visible', () => {
    placeAt(600)
    viewport.offsetTop = 400
    render(popover(items[0]))
    expect(screen.getByTestId('composer-popover').style.maxHeight).toBe('192px')
  })

  it('keeps its usual cap when there is room', () => {
    placeAt(900)
    render(popover(items[0]))
    expect(screen.getByTestId('composer-popover').style.maxHeight).toBe('360px')
  })

  it('scrolls the highlighted row into view inside the list, never the page', () => {
    placeAt(600)
    const { rerender } = render(popover(items[0]))
    const list = screen.getByTestId('composer-popover')
    Object.defineProperty(list, 'clientHeight', { value: 100, configurable: true })
    const row = screen.getByRole('option', { name: /Bot 9/ })
    Object.defineProperty(row, 'offsetTop', { value: 300, configurable: true })
    Object.defineProperty(row, 'offsetHeight', { value: 32, configurable: true })
    rerender(popover(items[9]))
    expect(list.scrollTop).toBe(232)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })
})
