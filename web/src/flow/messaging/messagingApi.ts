import type { ChatRecord, MessageRecord, MessageRole } from '../types'

function delay<T>(value: T, timeout = 80): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), timeout)
  })
}

function nextId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export const messagingApi = {
  async createChat(params: {
    title: string
    draft: string
    position?: ChatRecord['position']
  }): Promise<ChatRecord> {
    return delay({
      id: nextId('chat'),
      title: params.title,
      draft: params.draft,
      position: params.position,
    })
  },

  async updateChat(chatId: string, patch: Partial<Pick<ChatRecord, 'title' | 'draft'>>): Promise<void> {
    void chatId
    void patch
    return delay(undefined)
  },

  async deleteChat(chatId: string): Promise<void> {
    void chatId
    return delay(undefined)
  },

  async createMessage(params: {
    chatId: string
    text: string
    role: MessageRole
    ordinal: number
  }): Promise<MessageRecord> {
    return delay({
      id: nextId('message'),
      chatId: params.chatId,
      text: params.text,
      role: params.role,
      ordinal: params.ordinal,
    })
  },

  async deleteMessage(messageId: string): Promise<void> {
    void messageId
    return delay(undefined)
  },
}
