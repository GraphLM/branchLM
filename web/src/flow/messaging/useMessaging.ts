import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Edge, type OnNodesChange, type XYPosition } from '@xyflow/react'

import { buildContextEdgeId } from '../connections/connectionsModel'
import { computeChatPosition, createChatNode, createMessageNode } from '../layout'
import type { ChatRecord, FlowNode, MessageRecord } from '../types'
import {
  createChat,
  deleteChat as deleteChatApi,
  deleteMessage as deleteMessageApi,
  fetchGraph,
  generateReply,
  saveGraphLayout,
  updateChatTitle,
} from './messagingApi'

type UseMessagingReturn = {
  nodes: FlowNode[]
  initialEdges: Edge[]
  composerText: string
  isSubmitting: boolean
  setComposerText: (value: string) => void
  createChatFromComposer: () => Promise<void>
  createBranchChatFromMessage: (params: {
    sourceMessageId: string
    position: XYPosition
  }) => Promise<string | null>
  updateChatPosition: (chatId: string, position: XYPosition) => void
  syncContextEdges: (edges: Edge[]) => void
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
  const [contextEdges, setContextEdges] = useState<Edge[]>([])
  const [composerText, setComposerText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const graph = await fetchGraph()
      if (!graph || cancelled) return

      setChats(
        graph.chats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          draft: '',
          position: chat.position,
        })),
      )
      setMessages(
        graph.messages.map((message) => ({
          id: message.id,
          chatId: message.chatId,
          ordinal: message.ordinal,
          role: message.role,
          text: message.text,
        })),
      )
      setContextEdges(
        graph.contextEdges.map((edge) => ({
          id: buildContextEdgeId(edge.fromMessageId, edge.toChatId),
          source: edge.fromMessageId,
          target: edge.toChatId,
        })),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const persistLayout = useCallback(
    (nextChats: ChatRecord[], nextEdges: Edge[]) => {
      void saveGraphLayout({ chats: nextChats, edges: nextEdges })
    },
    [],
  )

  const updateChatTitleAndPersist = useCallback((chatId: string, title: string) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)))
    void updateChatTitle({ chatId, title })
  }, [])

  const updateChatDraft = useCallback((chatId: string, draft: string) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, draft } : chat)))
  }, [])

  const updateChatPosition = useCallback(
    (chatId: string, position: XYPosition) => {
      setChats((prev) => {
        const nextChats = prev.map((chat) => (chat.id === chatId ? { ...chat, position } : chat))
        persistLayout(nextChats, contextEdges)
        return nextChats
      })
    },
    [contextEdges, persistLayout],
  )

  const syncContextEdges = useCallback(
    (edges: Edge[]) => {
      const nextEdges = edges
        .filter((edge) => edge.id.startsWith('ctx:'))
        .map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }))
      setContextEdges(nextEdges)
      persistLayout(chats, nextEdges)
    },
    [chats, persistLayout],
  )

  const deleteChat = useCallback(async (chatId: string) => {
    await deleteChatApi({ chatId })
    setChats((prev) => prev.filter((chat) => chat.id !== chatId))
    setMessages((prev) => prev.filter((message) => message.chatId !== chatId))
    setContextEdges((prev) => prev.filter((edge) => edge.target !== chatId))
  }, [])

  const deleteMessage = useCallback(async (messageId: string) => {
    await deleteMessageApi({ messageId })

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
    setContextEdges((prev) => prev.filter((edge) => edge.source !== messageId))
  }, [])

  const sendMessageInChat = useCallback(
    async (chatId: string) => {
      const chat = findChatById(chats, chatId)
      if (!chat) return

      const input = chat.draft.trim()
      if (!input) return

      setIsSubmitting(true)
      setChats((prev) => prev.map((item) => (item.id === chatId ? { ...item, draft: '' } : item)))

      const generated = await generateReply({ chatId, text: input })
      if (!generated.ok) {
        setChats((prev) => prev.map((item) => (item.id === chatId ? { ...item, draft: input } : item)))
        setIsSubmitting(false)
        return
      }

      setMessages((prev) => {
        const next = prev
          .filter((message) => message.chatId !== chatId)
          .concat(normalizeMessages(prev, chatId))
          .concat([
            {
              id: generated.userMessage.id,
              chatId: generated.userMessage.chatId,
              ordinal: generated.userMessage.ordinal,
              role: 'user',
              text: generated.userMessage.text,
            },
            {
              id: generated.appMessage.id,
              chatId: generated.appMessage.chatId,
              ordinal: generated.appMessage.ordinal,
              role: 'app',
              text: generated.appMessage.text,
            },
          ])
        return next
      })
      setIsSubmitting(false)
    },
    [chats],
  )

  const createChatFromComposer = useCallback(async () => {
    const input = composerText.trim()
    if (!input) return

    setIsSubmitting(true)
    const nextChatTitle = `Chat ${chats.length + 1}`
    const position = computeChatPosition(chats.length)
    const createdChat = await createChat({ title: nextChatTitle, position })
    if (!createdChat) {
      setIsSubmitting(false)
      return
    }

    const newChat: ChatRecord = { id: createdChat.id, title: createdChat.title, draft: '', position }
    setChats((prev) => prev.concat(newChat))
    persistLayout(chats.concat(newChat), contextEdges)

    const generated = await generateReply({ chatId: createdChat.id, text: input })
    if (!generated.ok) {
      setIsSubmitting(false)
      return
    }

    setMessages((prev) =>
      prev.concat([
        {
          id: generated.userMessage.id,
          chatId: generated.userMessage.chatId,
          ordinal: generated.userMessage.ordinal,
          role: 'user',
          text: generated.userMessage.text,
        },
        {
          id: generated.appMessage.id,
          chatId: generated.appMessage.chatId,
          ordinal: generated.appMessage.ordinal,
          role: 'app',
          text: generated.appMessage.text,
        },
      ]),
    )
    setComposerText('')
    setIsSubmitting(false)
  }, [chats, composerText, contextEdges, persistLayout])

  const createBranchChatFromMessage = useCallback(
    async (params: { sourceMessageId: string; position: XYPosition }) => {
      const sourceMessage = messages.find((message) => message.id === params.sourceMessageId)
      if (!sourceMessage) return null

      setIsSubmitting(true)
      const createdChat = await createChat({
        title: `Branch ${chats.length + 1}`,
        position: params.position,
      })
      if (!createdChat) {
        setIsSubmitting(false)
        return null
      }

      const newChat: ChatRecord = {
        id: createdChat.id,
        title: createdChat.title,
        draft: '',
        position: params.position,
      }
      setChats((prev) => prev.concat(newChat))
      persistLayout(chats.concat(newChat), contextEdges)
      setIsSubmitting(false)
      return createdChat.id
    },
    [chats, contextEdges, messages, persistLayout],
  )

  const nodes = useMemo<FlowNode[]>(() => {
    return chats.flatMap((chat, index) => {
      const chatMessages = normalizeMessages(messages, chat.id)

      const chatNode = createChatNode({
        chatId: chat.id,
        data: { title: chat.title, draft: chat.draft },
        messageCount: chatMessages.length,
        position: chat.position ?? computeChatPosition(index),
        ui: {
          onUpdateTitle: updateChatTitleAndPersist,
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
  }, [chats, messages, updateChatTitleAndPersist, updateChatDraft, sendMessageInChat, deleteChat, deleteMessage])

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
        if (change.type !== 'position') continue
        if (!chatIds.has(change.id)) continue
        const nextPosition = change.position ?? change.positionAbsolute
        if (!nextPosition) continue
        positionByChatId.set(change.id, nextPosition)
      }

      if (positionByChatId.size === 0) return prevChats

      let didChange = false
      const nextChats = prevChats.map((chat) => {
        const nextPosition = positionByChatId.get(chat.id)
        if (!nextPosition) return chat
        const currentPosition = chat.position
        if (currentPosition && currentPosition.x === nextPosition.x && currentPosition.y === nextPosition.y) {
          return chat
        }
        didChange = true
        return { ...chat, position: nextPosition }
      })

      if (didChange) persistLayout(nextChats, contextEdges)
      return didChange ? nextChats : prevChats
    })
  }, [contextEdges, persistLayout])

  return {
    nodes,
    initialEdges: contextEdges,
    composerText,
    isSubmitting,
    setComposerText,
    createChatFromComposer,
    createBranchChatFromMessage,
    updateChatPosition,
    syncContextEdges,
    onNodesChange,
    deleteNodeById,
  }
}
