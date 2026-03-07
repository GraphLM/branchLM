import type { XYPosition } from '@xyflow/react'

import type { ChatFlowNode, ChatNodeData, MessageFlowNode, MessageNodeData, MessageRole } from './types'

const CHAT_WIDTH = 360
const CHAT_MIN_HEIGHT = 180
const CHAT_HEADER_HEIGHT = 72
const CHAT_COMPOSER_HEIGHT = 72
const CHAT_PADDING = 16
const MESSAGE_HEIGHT = 48
const MESSAGE_GAP = 10
const CHAT_GAP = 40
const CHAT_TOP = 24
const CHAT_LEFT = 24

export function computeMessagePosition(ordinal: number): XYPosition {
  return {
    x: CHAT_PADDING,
    y: CHAT_HEADER_HEIGHT + CHAT_PADDING + ordinal * (MESSAGE_HEIGHT + MESSAGE_GAP),
  }
}

export function computeChatHeight(messageCount: number): number {
  const clampedCount = Math.max(messageCount, 0)
  const messagesHeight =
    clampedCount === 0 ? 0 : clampedCount * MESSAGE_HEIGHT + (clampedCount - 1) * MESSAGE_GAP

  return Math.max(
    CHAT_MIN_HEIGHT,
    CHAT_HEADER_HEIGHT + CHAT_COMPOSER_HEIGHT + CHAT_PADDING * 3 + messagesHeight,
  )
}

export function createChatNode(params: {
  chatId: string
  data: ChatNodeData
  messageCount: number
  position: XYPosition
  ui: Pick<
    ChatFlowNode['data'],
    'onUpdateTitle' | 'onUpdateDraft' | 'onSendMessage' | 'onDeleteChat'
  >
}): ChatFlowNode {
  const { chatId, data, messageCount, position, ui } = params

  return {
    id: chatId,
    type: 'chat',
    position,
    draggable: true,
    selectable: true,
    data: {
      chatId,
      title: data.title,
      draft: data.draft,
      ...ui,
    },
    style: {
      width: CHAT_WIDTH,
      height: computeChatHeight(messageCount),
      overflow: 'visible',
    },
  }
}

export function createMessageNode(params: {
  messageId: string
  chatId: string
  data: MessageNodeData
  ui: Pick<MessageFlowNode['data'], 'onDeleteMessage'>
}): MessageFlowNode {
  const { messageId, chatId, data, ui } = params

  return {
    id: messageId,
    type: 'message',
    parentId: chatId,
    draggable: false,
    extent: 'parent',
    position: computeMessagePosition(data.ordinal),
    data: {
      messageId,
      text: data.text,
      role: data.role,
      ordinal: data.ordinal,
      ...ui,
    },
    style: {
      width: CHAT_WIDTH - CHAT_PADDING * 2,
      height: MESSAGE_HEIGHT,
    },
  }
}

export function computeChatPosition(chatOrdinal: number): XYPosition {
  return {
    x: CHAT_LEFT + chatOrdinal * (CHAT_WIDTH + CHAT_GAP),
    y: CHAT_TOP,
  }
}

export function createMockReply(input: string): { text: string; role: MessageRole } {
  return {
    role: 'app',
    text: `Echo: ${input}`,
  }
}
