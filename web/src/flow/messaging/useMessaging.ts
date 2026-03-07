import { useCallback, useMemo, useState } from 'react'
import { type OnNodesChange, type XYPosition } from '@xyflow/react'

import {
  computeChatPosition,
  createChatNode,
  createMessageNode,
  createMockReply,
} from '../layout'
import type { ChatRecord, FlowNode, MessageRecord } from '../types'
import { messagingApi } from './messagingApi'

type UseMessagingReturn = {
  nodes: FlowNode[]
  composerText: string
  isSubmitting: boolean
  setComposerText: (value: string) => void
  createChatFromComposer: () => Promise<void>
  createBranchChatFromMessage: (params: {
    sourceMessageId: string
    position: XYPosition
  }) => Promise<string | null>
  updateChatPosition: (chatId: string, position: XYPosition) => void
  onNodesChange: OnNodesChange<FlowNode>
  deleteNodeById: (nodeId: string) => Promise<void>
}

function normalizeMessages(messages: MessageRecord[], chatId: string): MessageRecord[] {
  const chatMessages = messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.ordinal - b.ordinal)

  return chatMessages.map((message, index) => ({
    ...message,
    ordinal: index,
  }))
}

function findChatById(chats: ChatRecord[], chatId: string): ChatRecord | undefined {
  return chats.find((chat) => chat.id === chatId)
}

export function useMessaging(): UseMessagingReturn {
  const [chats, setChats] = useState<ChatRecord[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [composerText, setComposerText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)))
    void messagingApi.updateChat(chatId, { title })
  }, [])

  const updateChatDraft = useCallback((chatId: string, draft: string) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, draft } : chat)))
    void messagingApi.updateChat(chatId, { draft })
  }, [])

  const updateChatPosition = useCallback((chatId: string, position: XYPosition) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, position } : chat)))
  }, [])

  const deleteChat = useCallback(async (chatId: string) => {
    await messagingApi.deleteChat(chatId)
    setChats((prev) => prev.filter((chat) => chat.id !== chatId))
    setMessages((prev) => prev.filter((message) => message.chatId !== chatId))
  }, [])

  const deleteMessage = useCallback(async (messageId: string) => {
    await messagingApi.deleteMessage(messageId)

    setMessages((prev) => {
      const target = prev.find((message) => message.id === messageId)
      if (!target) {
        return prev
      }

      const withoutTarget = prev.filter((message) => message.id !== messageId)
      const normalizedChatMessages = normalizeMessages(withoutTarget, target.chatId)
      const otherMessages = withoutTarget.filter((message) => message.chatId !== target.chatId)

      return [...otherMessages, ...normalizedChatMessages]
    })
  }, [])

  const sendMessageInChat = useCallback(
    async (chatId: string) => {
      const chat = findChatById(chats, chatId)
      if (!chat) {
        return
      }

      const input = chat.draft.trim()
      if (!input) {
        return
      }

      setIsSubmitting(true)
      try {
        const chatMessages = normalizeMessages(messages, chatId)
        const userMessage = await messagingApi.createMessage({
          chatId,
          text: input,
          role: 'user',
          ordinal: chatMessages.length,
        })
        const reply = createMockReply(input)
        const appMessage = await messagingApi.createMessage({
          chatId,
          text: reply.text,
          role: reply.role,
          ordinal: chatMessages.length + 1,
        })

        setMessages((prev) => {
          const otherMessages = prev.filter((message) => message.chatId !== chatId)
          return [...otherMessages, ...chatMessages, userMessage, appMessage]
        })

        setChats((prev) =>
          prev.map((item) => (item.id === chatId ? { ...item, draft: '' } : item)),
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [chats, messages],
  )

  const createChatFromComposer = useCallback(async () => {
    const input = composerText.trim()
    if (!input) {
      return
    }

    setIsSubmitting(true)
    try {
      const nextChatTitle = `Chat ${chats.length + 1}`

      const newChat = await messagingApi.createChat({
        title: nextChatTitle,
        draft: '',
      })

      const userMessage = await messagingApi.createMessage({
        chatId: newChat.id,
        text: input,
        role: 'user',
        ordinal: 0,
      })

      const reply = createMockReply(input)
      const appMessage = await messagingApi.createMessage({
        chatId: newChat.id,
        text: reply.text,
        role: reply.role,
        ordinal: 1,
      })

      setChats((prev) => [...prev, newChat])
      setMessages((prev) => [...prev, userMessage, appMessage])
      setComposerText('')
    } finally {
      setIsSubmitting(false)
    }
  }, [composerText, chats.length])

  const createBranchChatFromMessage = useCallback(
    async (params: { sourceMessageId: string; position: XYPosition }) => {
      const sourceMessage = messages.find((message) => message.id === params.sourceMessageId)
      if (!sourceMessage) {
        return null
      }

      setIsSubmitting(true)
      try {
        const newChat = await messagingApi.createChat({
          title: `Branch ${chats.length + 1}`,
          draft: '',
          position: params.position,
        })

        setChats((prev) => [...prev, newChat])
        return newChat.id
      } finally {
        setIsSubmitting(false)
      }
    },
    [messages, chats.length],
  )

  const nodes = useMemo<FlowNode[]>(() => {
    return chats.flatMap((chat, index) => {
      const chatMessages = normalizeMessages(messages, chat.id)

      const chatNode = createChatNode({
        chatId: chat.id,
        data: {
          title: chat.title,
          draft: chat.draft,
        },
        messageCount: chatMessages.length,
        position: chat.position ?? computeChatPosition(index),
        ui: {
          onUpdateTitle: updateChatTitle,
          onUpdateDraft: updateChatDraft,
          onSendMessage: sendMessageInChat,
          onDeleteChat: (targetChatId) => {
            void deleteChat(targetChatId)
          },
        },
      })

      const messageNodes = chatMessages.map((message) =>
        createMessageNode({
          messageId: message.id,
          chatId: chat.id,
          data: {
            text: message.text,
            role: message.role,
            ordinal: message.ordinal,
          },
          ui: {
            onDeleteMessage: (targetMessageId) => {
              void deleteMessage(targetMessageId)
            },
          },
        }),
      )

      return [chatNode, ...messageNodes]
    })
  }, [chats, messages, updateChatTitle, updateChatDraft, sendMessageInChat, deleteChat, deleteMessage])

  const deleteNodeById = useCallback(
    async (nodeId: string) => {
      const chat = chats.find((item) => item.id === nodeId)
      if (chat) {
        await deleteChat(nodeId)
        return
      }

      const message = messages.find((item) => item.id === nodeId)
      if (message) {
        await deleteMessage(nodeId)
      }
    },
    [chats, messages, deleteChat, deleteMessage],
  )

  const onNodesChange: OnNodesChange<FlowNode> = useCallback((changes) => {
    setChats((prevChats) => {
      const chatIds = new Set(prevChats.map((chat) => chat.id))
      const positionByChatId = new Map<string, XYPosition>()

      for (const change of changes) {
        if (change.type !== 'position') {
          continue
        }

        if (!chatIds.has(change.id)) {
          continue
        }

        const nextPosition = change.position ?? change.positionAbsolute
        if (!nextPosition) {
          continue
        }

        positionByChatId.set(change.id, nextPosition)
      }

      if (positionByChatId.size === 0) {
        return prevChats
      }

      return prevChats.map((chat) => ({
        ...chat,
        position: positionByChatId.get(chat.id) ?? chat.position,
      }))
    })
  }, [])

  return {
    nodes,
    composerText,
    isSubmitting,
    setComposerText,
    createChatFromComposer,
    createBranchChatFromMessage,
    updateChatPosition,
    onNodesChange,
    deleteNodeById,
  }
}
