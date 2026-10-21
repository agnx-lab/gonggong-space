import type { GroupPluginDto, MessageDto } from '@gonggong/protocol'
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { api } from '../../lib/api'
import type { CreationDraft } from './model'

/**
 * Each group's plugins (GET /groups/:id/plugins), loaded on first use. Empty while the master switch is off, and
 * also when the request fails (an older server): the chat then looks exactly as without plugins.
 */
export const usePluginStore = create<{ lists: Record<string, GroupPluginDto[]> }>()(() => ({ lists: {} }))
const loading = new Set<string>()

export function loadPlugins(groupId: string) {
  if (loading.has(groupId)) return
  loading.add(groupId)
  const done = (list: GroupPluginDto[]) =>
    usePluginStore.setState((s) => ({ lists: { ...s.lists, [groupId]: list } }))
  api
    .get<GroupPluginDto[]>(`/groups/${groupId}/plugins`)
    .then(done, () => done([]))
    .finally(() => loading.delete(groupId))
}

/** Undefined until loaded. */
export function useGroupPlugins(groupId: string) {
  const list = usePluginStore((s) => s.lists[groupId])
  useEffect(() => {
    if (!list) loadPlugins(groupId)
  }, [groupId, list])
  return list
}

/** Plugins turned on in the group: what 创作 offers. Reads what the chat view (useGroupPlugins) loaded. */
export function useEnabledPlugins(groupId: string) {
  const list = usePluginStore((s) => s.lists[groupId])
  return useMemo(() => list?.filter((p) => p.enabledInGroup) ?? [], [list])
}

export function putPlugin(groupId: string, p: GroupPluginDto) {
  usePluginStore.setState((s) => ({
    lists: { ...s.lists, [groupId]: (s.lists[groupId] ?? []).map((x) => (x.id === p.id ? p : x)) },
  }))
}

export async function togglePlugin(groupId: string, pluginId: string, enabled: boolean) {
  putPlugin(groupId, await api.put<GroupPluginDto>(`/groups/${groupId}/plugins/${pluginId}`, { enabled }))
}

export const createInGroup = (groupId: string, body: unknown) =>
  api.post<MessageDto>(`/groups/${groupId}/creations`, body)

/** The open 创作 panel: a plugin to preselect, or a whole draft to start from (改参数重做). */
export interface CreationOpen {
  groupId: string
  pluginId?: string
  draft?: CreationDraft
  step?: number
}
export const useCreation = create<{ open: CreationOpen | null }>()(() => ({ open: null }))
export const openCreation = (open: CreationOpen) => useCreation.setState({ open })
export const closeCreation = () => useCreation.setState({ open: null })
