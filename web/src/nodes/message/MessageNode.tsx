import type { NodeProps } from '@xyflow/react'

import type { MessageNodeUiData } from '../../flow/types'
import { MessageBubble } from './MessageBubble'

export function MessageNode(props: NodeProps) {
  const data = props.data as MessageNodeUiData

  return <MessageBubble onDelete={() => data.onDeleteMessage(data.messageId)} role={data.role} text={data.text} />
}
