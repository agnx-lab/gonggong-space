import { act, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useBenchMode } from '../src/app/ChatLayout'
import { useIsMobile } from '../src/app/viewport'

const initial = window.innerWidth
const resize = (w: number) =>
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: w })
    window.dispatchEvent(new Event('resize'))
  })

afterEach(() => Object.defineProperty(window, 'innerWidth', { configurable: true, value: initial }))

it('re-renders breakpoint users only when a breakpoint is crossed, not on every resize', () => {
  resize(800)
  const renders = { mobile: 0, bench: 0 }
  function Mobile() {
    renders.mobile++
    return <span>{String(useIsMobile())}</span>
  }
  function Bench() {
    renders.bench++
    return <span>{useBenchMode()}</span>
  }
  render(
    <>
      <Mobile />
      <Bench />
    </>,
  )
  expect(renders).toEqual({ mobile: 1, bench: 1 })
  resize(900)
  expect(renders).toEqual({ mobile: 1, bench: 1 })
  resize(700)
  expect(renders).toEqual({ mobile: 2, bench: 1 })
  resize(1200)
  expect(renders).toEqual({ mobile: 3, bench: 2 })
  resize(1300)
  expect(renders).toEqual({ mobile: 3, bench: 2 })
})
