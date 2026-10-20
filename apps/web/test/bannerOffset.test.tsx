import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHeightVar } from '../src/lib/useHeightVar'

let resize: () => void
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function View({ height }: { height: () => number }) {
  const outer = useRef<HTMLDivElement>(null)
  const banners = useRef<HTMLDivElement>(null)
  useHeightVar(banners, outer, '--banners-h')
  return (
    <div ref={outer} data-testid="outer">
      <div
        ref={(el) => {
          banners.current = el
          if (el) Object.defineProperty(el, 'offsetHeight', { get: height, configurable: true })
        }}
      />
    </div>
  )
}

describe('useHeightVar (date separator below the sticky banners)', () => {
  it('publishes the banners height as a CSS variable and follows it as prompts come and go', () => {
    let h = 46
    const { getByTestId } = render(<View height={() => h} />)
    const outer = getByTestId('outer')
    expect(outer.style.getPropertyValue('--banners-h')).toBe('46px')
    h = 98
    act(() => resize())
    expect(outer.style.getPropertyValue('--banners-h')).toBe('98px')
  })
})
