import type { GroupDto } from '@gonggong/protocol'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { Sidebar } from '../src/app/Sidebar'

const group = (id: string, lastAt: string): GroupDto => ({
  id,
  teamId: 't1',
  name: id,
  kind: 'group',
  mode: 'partition',
  adminOnlyInvite: false,
  protectBase: false,
  notice: '',
  noticeHidden: false,
  avatar: null,
  repo: null,
  members: [],
  botIds: [],
  unread: 0,
  lastSeq: 1,
  last: '',
  lastAt,
  pinned: false,
  muted: false,
  foldRuns: false,
  liveRunIds: [],
  liveRuns: [],
})

const groups = [
  group('g1', '2026-09-23T03:00:00.000Z'),
  group('g2', '2026-09-23T02:00:00.000Z'),
  group('g3', '2026-09-23T01:00:00.000Z'),
]

/** Renders the list with g2 open; returns a re-render with other groups. */
function renderList() {
  const ui = (list: GroupDto[]) => (
    <MemoryRouter initialEntries={['/g/g2']}>
      <Sidebar groups={list} bots={[]} machines={[]} loaded guide={false} />
    </MemoryRouter>
  )
  const { rerender } = render(ui(groups))
  return (list: GroupDto[]) => rerender(ui(list))
}

afterEach(() => vi.restoreAllMocks())

it('re-renders only the conversation rows whose group changed', () => {
  const rerender = renderList()
  // Every row but the open one reads its draft when it renders.
  const getItem = vi.spyOn(Storage.prototype, 'getItem')
  rerender([{ ...groups[0]!, unread: 2 }, groups[1]!, groups[2]!])
  const drafts = getItem.mock.calls.map(([key]) => key).filter((key) => key.startsWith('gonggong:draft:'))
  expect(drafts).toEqual(['gonggong:draft:g1'])
})

it('re-measures the selection capsule only when the open conversation moves', () => {
  const rerender = renderList()
  const measure = vi.spyOn(Element.prototype, 'getBoundingClientRect')
  rerender([{ ...groups[0]!, unread: 2 }, groups[1]!, groups[2]!])
  expect(measure).not.toHaveBeenCalled()
  rerender([groups[0]!, groups[1]!, { ...groups[2]!, lastAt: '2026-09-23T04:00:00.000Z' }])
  expect(measure).toHaveBeenCalled()
})
