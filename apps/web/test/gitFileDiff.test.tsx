import type { GitDiffDto } from '@gonggong/protocol'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitFileDiff } from '../src/features/diff/GitFileDiff'

const URL = '/groups/g1/bots/b1/git/diff?from=main&path=a.ts'

function serve(body: GitDiffDto | null, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      status === 200
        ? new Response(JSON.stringify(body))
        : new Response(JSON.stringify({ error: 'conflict', message: 'Bot 所在机器离线' }), { status }),
    ),
  )
}
afterEach(() => vi.unstubAllGlobals())

const lines = () => Array.from(document.querySelectorAll('.diff__line'), (l) => l.textContent)

describe('git file diff', () => {
  it('shows the file’s hunks', async () => {
    serve({ patch: 'diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-old\n+new\n', truncated: false })
    render(<GitFileDiff url={URL} path="a.ts" />)
    await waitFor(() => expect(lines()).toEqual(['@@ -1 +1 @@', '-old', '+new']))
    expect(screen.queryByText('差异过大，已截断')).toBeNull()
  })

  it('says when the patch was cut', async () => {
    serve({ patch: 'diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-old\n', truncated: true })
    render(<GitFileDiff url={URL} path="a.ts" />)
    expect(await screen.findByText('差异过大，已截断')).toBeTruthy()
    expect(lines()).toEqual(['@@ -1 +1 @@', '-old'])
  })

  it.each(['', null])('says when there is no difference (patch %j)', async (patch) => {
    serve({ patch, truncated: false })
    render(<GitFileDiff url={URL} path="a.ts" />)
    expect(await screen.findByText('没有差异')).toBeTruthy()
  })

  it('does not draw a binary file', async () => {
    serve({
      patch: 'diff --git a/a.png b/a.png\nindex 1..2 100644\nBinary files a/a.png and b/a.png differ\n',
      truncated: false,
    })
    render(<GitFileDiff url={URL} path="a.png" />)
    expect(await screen.findByText('二进制文件，无法显示差异')).toBeTruthy()
    expect(lines()).toEqual([])
  })

  it('shows why it could not be read', async () => {
    serve(null, 409)
    render(<GitFileDiff url={URL} path="a.ts" />)
    expect(await screen.findByText('无法读取差异')).toBeTruthy()
    expect(screen.getByText('Bot 所在机器离线')).toBeTruthy()
  })
})
