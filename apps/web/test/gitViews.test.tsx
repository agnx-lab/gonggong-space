import type { BotDto, FileTreeEntry, GitCommit, GitRefsDto, GroupDto } from '@gonggong/protocol'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tabKey, useWorkbench, type WorkbenchTab } from '../src/app/workbench'
import { useWorkspace } from '../src/app/workspace'
import { TabContent, TabLabel } from '../src/features/workbench/TabContent'

const entry = (name: string, o: Partial<FileTreeEntry> = {}): FileTreeEntry => ({
  name,
  dir: false,
  size: 10,
  mtime: 0,
  uncommitted: false,
  ignored: false,
  ...o,
})

const commit = (n: number, o: Partial<GitCommit> = {}): GitCommit => ({
  hash: `${n}`.repeat(40),
  shortHash: `${n}`.repeat(7),
  author: '小王',
  email: 'w@corp',
  at: '2026-10-20T00:00:00.000Z',
  subject: `提交 ${n}`,
  parents: [`${n + 1}`.repeat(40)],
  refs: [],
  ...o,
})

const REFS: GitRefsDto = {
  branches: [
    {
      name: 'feat/x',
      kind: 'local',
      current: true,
      upstream: null,
      ahead: null,
      behind: null,
      commit: 'a',
      subject: '',
      at: '',
    },
    {
      name: 'main',
      kind: 'local',
      current: false,
      upstream: null,
      ahead: null,
      behind: null,
      commit: 'b',
      subject: '',
      at: '',
    },
  ],
  remotes: [],
}

let calls: string[]
beforeEach(() => {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      const u = new URL(url, 'http://x')
      const q = (k: string) => u.searchParams.get(k)
      const json = (v: unknown) => new Response(JSON.stringify(v))
      const base = '/api/groups/g1/bots/b1'
      switch (u.pathname) {
        case `${base}/git/refs`:
          return json(REFS)
        case `${base}/git/log`:
          if (q('ref') === 'main') return json({ commits: [commit(7)], hasMore: false })
          return q('skip') === '2'
            ? json({ commits: [commit(3)], hasMore: false })
            : json({
                commits: [commit(1, { refs: ['HEAD -> feat/x', 'origin/feat/x'] }), commit(2)],
                hasMore: true,
              })
        case `${base}/git/compare`:
          return json({
            changes:
              q('from') === 'main'
                ? [
                    { path: 'README.md', change: 'modified', oldPath: null },
                    { path: 'src/new.ts', change: 'added', oldPath: null },
                    { path: 'old.ts', change: 'deleted', oldPath: null },
                  ]
                : [
                    { path: 'src/a.ts', change: 'modified', oldPath: null },
                    { path: 'b.ts', change: 'renamed', oldPath: 'a.ts' },
                  ],
          })
        case `${base}/git/tree`:
        case `${base}/files/tree`: {
          const path = q('path') ?? ''
          const entries = path === '' ? [entry('src', { dir: true }), entry('README.md')] : [entry('new.ts')]
          return json({ path, entries, truncated: false })
        }
        case `${base}/git/text`:
        case `${base}/files/text`:
          return json({
            path: q('path'),
            size: 3,
            binary: false,
            mime: 'text/plain',
            text: `${q('ref') ?? 'ws'}:${q('path')}`,
          })
      }
      return new Response('{}', { status: 404 })
    }),
  )
  useWorkspace.setState({
    bots: [{ id: 'b1', name: '小王的 Claude' } as BotDto],
    botStates: {},
    groups: [{ id: 'g1', mode: 'partition', repo: { url: 'git@x:r.git', branch: 'main' } } as GroupDto],
  })
  useWorkbench.setState({ groupId: 'g1', open: true, benches: {} })
})
afterEach(() => vi.unstubAllGlobals())

const current = () => useWorkbench.getState().benches.g1?.tabs ?? []

function Bench() {
  const tabs = useWorkbench((s) => s.benches.g1?.tabs ?? [])
  return (
    <>
      {tabs.map((t) => (
        <section key={tabKey(t)} data-testid={tabKey(t)}>
          <TabLabel tab={t}>{(m) => <h2 data-icon={m.icon}>{m.title}</h2>}</TabLabel>
          <TabContent tab={t} active />
        </section>
      ))}
    </>
  )
}
const open = (t: WorkbenchTab) => {
  act(() => {
    useWorkbench.getState().show(t)
  })
  return render(<Bench />)
}

describe('commit history tab', () => {
  it('pages the log, switches the ref and shows a commit’s changed files', async () => {
    open({ kind: 'git-log', botId: 'b1', ref: null, commit: null })
    const tab = within(screen.getByTestId('git-log:b1'))
    expect(tab.getByRole('heading').textContent).toBe('提交历史 · 小王的 Claude')
    const first = await tab.findByRole('button', { name: /提交 1/ })
    expect(calls).toContain('/api/groups/g1/bots/b1/git/log?skip=0')
    expect(first.textContent).toContain('1111111')
    expect(first.textContent).toContain('小王')
    expect(within(first).getByText('HEAD -> feat/x')).toBeTruthy()

    fireEvent.click(tab.getByRole('button', { name: '加载更多' }))
    expect(await tab.findByRole('button', { name: /提交 3/ })).toBeTruthy()
    expect(calls).toContain('/api/groups/g1/bots/b1/git/log?skip=2')
    expect(tab.queryByRole('button', { name: '加载更多' })).toBeNull()

    fireEvent.click(tab.getByRole('button', { name: /提交 2/ }))
    expect(current()[0]).toMatchObject({ commit: '2'.repeat(40) })
    const files = within(await tab.findByRole('list', { name: '变更文件' }))
    expect(calls).toContain(`/api/groups/g1/bots/b1/git/compare?from=${'3'.repeat(40)}&to=${'2'.repeat(40)}`)
    expect(files.getByRole('button', { name: /src\/a\.ts/ }).textContent).toContain('M')
    expect(files.getByRole('button', { name: /b\.ts/ }).textContent).toContain('a.ts → b.ts')
    fireEvent.click(files.getByRole('button', { name: /src\/a\.ts/ }))
    expect(current().at(-1)).toEqual({
      kind: 'file',
      source: { botId: 'b1', path: 'src/a.ts', rev: '2'.repeat(40) },
    })
    expect(await screen.findByText(`${'2'.repeat(40)}:src/a.ts`)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'a.ts @ 2222222' })).toBeTruthy()

    fireEvent.click(tab.getByRole('button', { name: '分支' }))
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'main' }))
    expect(await tab.findByRole('button', { name: /提交 7/ })).toBeTruthy()
    expect(calls).toContain('/api/groups/g1/bots/b1/git/log?ref=main&skip=0')
  })
})

describe('files tab versions', () => {
  it('offers versions only in partition groups with a repo', async () => {
    useWorkspace.setState({ groups: [{ id: 'g1', mode: 'force', repo: null } as unknown as GroupDto] })
    open({ kind: 'files', botId: 'b1', dir: '', selected: null })
    const files = within(screen.getByTestId('files:b1'))
    await files.findByRole('treeitem', { name: /README/ })
    expect(files.queryByRole('button', { name: '版本' })).toBeNull()
    expect(files.queryByRole('button', { name: '对比' })).toBeNull()
  })

  it('browses a branch through the git routes', async () => {
    open({ kind: 'files', botId: 'b1', dir: '', selected: null })
    const files = within(screen.getByTestId('files:b1'))
    await files.findByRole('treeitem', { name: /README/ })
    fireEvent.click(files.getByRole('button', { name: '版本' }))
    const pop = within(await screen.findByRole('dialog', { name: '版本' }))
    fireEvent.click(await pop.findByRole('button', { name: /^main/ }))
    expect(current()[0]).toMatchObject({ rev: 'main' })
    fireEvent.click(await files.findByRole('treeitem', { name: /README/ }))
    expect(calls).toContain('/api/groups/g1/bots/b1/git/tree?ref=main&path=')
    expect(await files.findByText('main:README.md')).toBeTruthy()
    expect(calls).toContain('/api/groups/g1/bots/b1/git/text?ref=main&path=README.md')
    expect(files.queryByRole('searchbox', { name: '搜索文件' })).toBeNull()

    fireEvent.click(files.getByRole('button', { name: '版本' }))
    fireEvent.click(
      await within(await screen.findByRole('dialog', { name: '版本' })).findByRole('button', {
        name: '工作区',
      }),
    )
    expect(current()[0]).toMatchObject({ rev: null })
    expect(await files.findByText('ws:README.md')).toBeTruthy()
  })

  it('compares against a base: marks changes in the tree and lists only changed files', async () => {
    open({ kind: 'files', botId: 'b1', dir: '', selected: null })
    const files = within(screen.getByTestId('files:b1'))
    await files.findByRole('treeitem', { name: /README/ })
    fireEvent.click(files.getByRole('button', { name: '对比' }))
    fireEvent.click(
      await within(await screen.findByRole('dialog', { name: '对比' })).findByRole('button', {
        name: /^main/,
      }),
    )
    await waitFor(() => expect(calls).toContain('/api/groups/g1/bots/b1/git/compare?from=main'))
    const tree = within(files.getByRole('tree', { name: '文件' }))
    expect(await tree.findByTitle('修改')).toBeTruthy()
    expect(within(tree.getByRole('treeitem', { name: /README/ })).getByTitle('修改').textContent).toBe('M')
    expect(within(tree.getByRole('treeitem', { name: /^src/ })).getByTitle('有变化')).toBeTruthy()

    fireEvent.click(files.getByRole('checkbox', { name: '只看有变化的' }))
    const list = within(files.getByRole('list', { name: '变更文件' }))
    expect(list.getAllByRole('button').map((b) => b.title)).toEqual(['README.md', 'src/new.ts', 'old.ts'])
    expect(within(list.getByRole('button', { name: /old\.ts/ })).getByTitle('删除').textContent).toBe('D')
    fireEvent.click(list.getByRole('button', { name: /old\.ts/ }))
    expect(await files.findByText('main:old.ts')).toBeTruthy()
  })
})
