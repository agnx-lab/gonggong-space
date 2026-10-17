import type { GroupDto } from '@gonggong/protocol'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkbench, type WorkbenchTab } from '../src/app/workbench'
import { useWorkspace } from '../src/app/workspace'
import { Workbench } from '../src/features/workbench/Workbench'

const highlighted = vi.hoisted(() => [] as string[])
vi.mock('../src/ui/highlight', async (orig) => {
  const m = await orig<typeof import('../src/ui/highlight')>()
  return {
    ...m,
    useHighlight: (code: string) => {
      highlighted.push(code)
      return null
    },
  }
})

const file = (path: string): WorkbenchTab => ({ kind: 'file', source: { botId: 'b1', path } })
const TEXT = 'const a = 1\nconst b = 2'

/** Like the chat page: re-renders on every change of the group list, with the workbench beside it. */
function Page() {
  useWorkspace((s) => s.groups)
  return <Workbench />
}

beforeEach(() => {
  highlighted.length = 0
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const path = new URL(input, 'http://x').searchParams.get('path') ?? ''
      const text = path === 'src/a.ts' ? TEXT : `// ${path}`
      return new Response(
        JSON.stringify({ path, size: text.length, binary: false, mime: 'text/plain', text }),
      )
    }),
  )
  useWorkspace.setState({ groups: [] })
  useWorkbench.setState({ groupId: 'g1', open: true, mode: 'split', benches: {} })
  for (const p of ['src/a.ts', 'src/b.ts', 'src/c.ts']) useWorkbench.getState().show(file(p))
})
afterEach(() => vi.unstubAllGlobals())

describe('workbench rendering', () => {
  it('leaves a loaded file alone on unrelated chat updates and while other tabs switch', async () => {
    render(<Page />)
    expect(await screen.findByText('const a = 1')).toBeTruthy()
    const renders = () => highlighted.filter((code) => code === TEXT).length
    const before = renders()

    act(() => useWorkspace.setState({ groups: [{ id: 'g2' } as GroupDto] }))
    expect(renders()).toBe(before)

    act(() => useWorkbench.getState().activate('file:b1:src/b.ts'))
    expect(renders()).toBe(before)
  })
})
