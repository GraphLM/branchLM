import { apiFetch } from '../../lib/api'
import type { Edge } from '@xyflow/react'
import type { ChatRecord, MessageRecord, MessageRole } from '../types'
import type { FlowNode } from '../types'

type GraphChatDTO = {
  id: string
  title: string
  position: { x: number; y: number }
}

type GraphMessageDTO = {
  id: string
  chatId: string
  ordinal: number
  role: MessageRole
  text: string
}

type GraphDTO = {
  chats?: GraphChatDTO[]
  messages?: GraphMessageDTO[]
}

function nextId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

async function tryRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  try {
    return await apiFetch(input, init)
  } catch {
    return null
  }
}

async function tryJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

const DEFAULT_CHAT_POSITION = { x: 24, y: 24 }

export const messagingApi = {
  async fetchGraph(): Promise<{ chats: ChatRecord[]; messages: MessageRecord[] }> {
    const res = await tryRequest('/api/graph')
    if (!res || !res.ok) {
      return { chats: [], messages: [] }
    }

    const payload = await tryJson<GraphDTO>(res)
    if (!payload) {
      return { chats: [], messages: [] }
    }

    const chats: ChatRecord[] = (payload.chats ?? []).map((chat) => ({
      id: chat.id,
      title: chat.title,
      draft: '',
      position: chat.position,
    }))

    const chatIds = new Set(chats.map((chat) => chat.id))
    const messages: MessageRecord[] = (payload.messages ?? [])
      .filter((message) => chatIds.has(message.chatId))
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((message) => ({
        id: message.id,
        chatId: message.chatId,
        text: message.text,
        role: message.role,
        ordinal: message.ordinal,
      }))

    return { chats, messages }
  },

  async createChat(params: {
    title: string
    draft: string
    position?: ChatRecord['position']
  }): Promise<ChatRecord> {
    const position = params.position ?? DEFAULT_CHAT_POSITION
    const res = await tryRequest('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        position,
      }),
    })

    if (res?.ok) {
      const created = await tryJson<{ id: string; title: string }>(res)
      if (created?.id) {
        return {
          id: created.id,
          title: created.title ?? params.title,
          draft: params.draft,
          position,
        }
      }
    }

    return {
      id: nextId('chat'),
      title: params.title,
      draft: params.draft,
      position: params.position,
    }
  },

  async updateChat(chatId: string, patch: Partial<Pick<ChatRecord, 'title' | 'draft'>>): Promise<void> {
    if (!patch.title) {
      return
    }

    const res = await tryRequest(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: patch.title }),
    })

    if (!res?.ok) {
      return
    }
  },

  async deleteChat(chatId: string): Promise<void> {
    const res = await tryRequest(`/api/chats/${chatId}`, {
      method: 'DELETE',
    })
    if (!res?.ok) {
      return
    }
  },

  async createMessage(params: {
    chatId: string
    text: string
    role: MessageRole
    ordinal: number
  }): Promise<MessageRecord> {
    const res = await tryRequest(`/api/chats/${params.chatId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: params.role,
        text: params.text,
      }),
    })

    if (res?.ok) {
      const created = await tryJson<{ id: string; ordinal: number }>(res)
      if (created?.id) {
        return {
          id: created.id,
          chatId: params.chatId,
          text: params.text,
          role: params.role,
          ordinal: created.ordinal ?? params.ordinal,
        }
      }
    }

    return {
      id: nextId('message'),
      chatId: params.chatId,
      text: params.text,
      role: params.role,
      ordinal: params.ordinal,
    }
  },

  async deleteMessage(messageId: string): Promise<void> {
    const res = await tryRequest(`/api/messages/${messageId}`, {
      method: 'DELETE',
    })
    if (!res?.ok) {
      return
    }
  },

  async saveGraphLayout(params: { nodes: FlowNode[]; edges: Edge[] }): Promise<void> {
    const chatPositions = Object.fromEntries(
      params.nodes
        .filter((node) => node.type === 'chat')
        .map((node) => [node.id, { x: node.position.x, y: node.position.y }]),
    )

    const edgesBySource = new Map<string, string[]>()
    for (const edge of params.edges) {
      const next = edgesBySource.get(edge.source) ?? []
      next.push(edge.target)
      edgesBySource.set(edge.source, next)
    }

    const contextEdges = Array.from(edgesBySource.entries()).flatMap(([sourceId, targetIds]) =>
      targetIds.map((targetId, index) => ({
        fromMessageId: sourceId,
        toChatId: targetId,
        rank: index,
      })),
    )

    const res = await tryRequest('/api/graph/layout', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chatPositions,
        contextEdges,
      }),
    })

    if (!res?.ok) {
      return
    }
  },
}
