import type { Node, XYPosition } from '@xyflow/react'

export type MessageRole = 'user' | 'app'

export type ChatNodeData = {
  title: string
  draft: string
}

export type MessageNodeData = {
  text: string
  role: MessageRole
  ordinal: number
}

export type ChatNodeUiData = ChatNodeData & {
  chatId: string
  onUpdateTitle: (chatId: string, title: string) => void
  onUpdateDraft: (chatId: string, draft: string) => void
  onSendMessage: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
}

export type MessageNodeUiData = MessageNodeData & {
  messageId: string
  onDeleteMessage: (messageId: string) => void
}

export type ChatFlowNode = Node<ChatNodeUiData, 'chat'>
export type MessageFlowNode = Node<MessageNodeUiData, 'message'>
export type FlowNode = ChatFlowNode | MessageFlowNode

export type ChatRecord = {
  id: string
  title: string
  draft: string
  position?: XYPosition
}

export type MessageRecord = {
  id: string
  chatId: string
  text: string
  role: MessageRole
  ordinal: number
}
