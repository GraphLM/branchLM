import { Handle, Position, type NodeProps } from '@xyflow/react'

import type { MessageNodeUiData } from '../../flow/types'
import { MessageBubble } from './MessageBubble'

export function MessageNode(props: NodeProps) {
  const data = props.data as MessageNodeUiData

  return (
    <MessageBubble
      onDelete={() => data.onDeleteMessage(data.messageId)}
      role={data.role}
      sourceHandle={
        <Handle
          className="rf-handle-connect rf-handle-connect--source !h-3.5 !w-3.5 !border-[color:var(--color-message-user-border)] !bg-[color:var(--color-canvas-base)]"
          position={Position.Right}
          style={{ top: '50%' }}
          type="source"
        />
      }
      text={data.text}
    />
  )
}
