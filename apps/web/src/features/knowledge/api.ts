import type { GroupKnowledgeDto, KnowledgeDetailDto } from '@gonggong/protocol'
import { useEffect } from 'react'
import { api } from '../../lib/api'
import { realtime } from '../../lib/realtime'
import { useGet } from '../../lib/useGet'

// The protocol exports only the zod schemas of these bodies (CreateKnowledgeReq, UpdateKnowledgeReq).
type Fields = { title: string; body: string; tags: string[]; pinned?: boolean }

export const knowledgeApi = {
  create: (groupId: string, body: Fields) =>
    api.post<KnowledgeDetailDto>(`/groups/${groupId}/knowledge`, body),
  update: (id: string, body: Partial<Fields> & { baseVersion: number }) =>
    api.patch<KnowledgeDetailDto>(`/knowledge/${id}`, body),
  remove: (id: string) => api.del(`/knowledge/${id}`),
  rollback: (id: string, version: number) =>
    api.post<KnowledgeDetailDto>(`/knowledge/${id}/rollback`, { version }),
}

/** The group's entries matching `q`, reloaded on its `group.knowledge` events and after a reconnect. */
export function useKnowledge(groupId: string, q: string) {
  const res = useGet<GroupKnowledgeDto>(
    `/groups/${groupId}/knowledge${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  )
  const { reload } = res
  useEffect(() => {
    const off = realtime.subscribe((e) => {
      if (e.t === 'group.knowledge' && e.groupId === groupId) reload()
    })
    const offReconnect = realtime.onReconnect(reload)
    return () => {
      off()
      offReconnect()
    }
  }, [groupId, reload])
  return res
}
