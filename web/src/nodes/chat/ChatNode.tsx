import { Handle, Position, type NodeProps } from '@xyflow/react'

import type { ChatFlowNode } from '../../flow/types'
import { ChatCard } from './ChatCard'

export function ChatNode(props: NodeProps<ChatFlowNode>) {
  const { data } = props

  return (
    <ChatCard
      chatId={data.chatId}
      draft={data.draft}
      onDeleteChat={data.onDeleteChat}
      onSendMessage={data.onSendMessage}
      onUpdateDraft={data.onUpdateDraft}
      onUpdateTitle={data.onUpdateTitle}
      targetHandle={
        <Handle
          className="rf-handle-connect rf-handle-connect--target !h-3.5 !w-3.5 !border-[color:var(--color-message-user-border)] !bg-[color:var(--color-canvas-base)]"
          position={Position.Left}
          style={{ top: '50%' }}
          type="target"
        />
      }
      title={data.title}
    />
  )
}
