import type { NodeProps } from '@xyflow/react'

import type { ChatNodeUiData } from '../../flow/types'
import { ChatCard } from './ChatCard'

export function ChatNode(props: NodeProps) {
  const data = props.data as ChatNodeUiData

  return (
    <ChatCard
      chatId={data.chatId}
      draft={data.draft}
      onDeleteChat={data.onDeleteChat}
      onSendMessage={data.onSendMessage}
      onUpdateDraft={data.onUpdateDraft}
      onUpdateTitle={data.onUpdateTitle}
      title={data.title}
    />
  )
}
