import type { Edge } from '@xyflow/react'
import { apiFetch } from '../../lib/api'
import type { ChatRecord } from '../types'

export type GraphMessageDTO = {
  id: string
  chatId: string
  ordinal: number
  role: 'user' | 'app'
  text: string
}

export type GraphContextEdgeDTO = {
  fromMessageId: string
  toChatId: string
  rank: number
}

export type GraphDTO = {
  chats: Array<{ id: string; title: string; position: { x: number; y: number } }>
  messages: GraphMessageDTO[]
  contextEdges: GraphContextEdgeDTO[]
}

export async function fetchGraph(): Promise<GraphDTO | null> {
  const res = await apiFetch('/api/graph')
  if (!res.ok) return null
  return (await res.json()) as GraphDTO
}

export async function saveGraphLayout(params: {
  chats: ChatRecord[]
  edges: Edge[]
}): Promise<void> {
  const chatPositions = Object.fromEntries(
    params.chats.map((chat) => [chat.id, { x: chat.position?.x ?? 0, y: chat.position?.y ?? 0 }]),
  )
  const contextEdges = params.edges
    .filter((edge) => edge.id.startsWith('ctx:'))
    .map((edge, index) => ({
      fromMessageId: edge.source,
      toChatId: edge.target,
      rank: index,
    }))

  await apiFetch('/api/graph/layout', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatPositions, contextEdges }),
  })
}

export async function createChat(params: {
  title: string
  position: { x: number; y: number }
}): Promise<{ id: string; title: string } | null> {
  const res = await apiFetch('/api/chats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: params.title, position: params.position }),
  })
  if (!res.ok) return null
  return (await res.json()) as { id: string; title: string }
}

export async function updateChatTitle(params: { chatId: string; title: string }): Promise<void> {
  await apiFetch(`/api/chats/${params.chatId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: params.title }),
  })
}

export async function deleteChat(params: { chatId: string }): Promise<void> {
  await apiFetch(`/api/chats/${params.chatId}`, { method: 'DELETE' })
}

export async function deleteMessage(params: { messageId: string }): Promise<void> {
  await apiFetch(`/api/messages/${params.messageId}`, { method: 'DELETE' })
}

export type GenerateReplyResult =
  | {
      ok: true
      userMessage: GraphMessageDTO
      appMessage: GraphMessageDTO
    }
  | {
      ok: false
      status: number
      detail: string
    }

export async function generateReply(params: {
  chatId: string
  text: string
}): Promise<GenerateReplyResult> {
  try {
    const res = await apiFetch(`/api/chats/${params.chatId}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: params.text }),
    })
    if (!res.ok) {
      let detail = 'Unable to generate a reply right now.'
      try {
        const payload = (await res.json()) as { detail?: string }
        if (typeof payload.detail === 'string' && payload.detail.trim().length > 0) {
          detail = payload.detail
        }
      } catch {
        // Keep fallback detail.
      }
      return { ok: false, status: res.status, detail }
    }

    const payload = (await res.json()) as {
      userMessage: GraphMessageDTO
      appMessage: GraphMessageDTO
    }
    return { ok: true, userMessage: payload.userMessage, appMessage: payload.appMessage }
  } catch {
    return {
      ok: false,
      status: 0,
      detail: 'Unable to reach the API right now.',
    }
  }
}
