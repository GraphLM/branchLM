import type { NodeTypes } from '@xyflow/react'

import { ChatNode } from './chat/ChatNode'
import { MessageNode } from './message/MessageNode'

export const nodeTypes: NodeTypes = {
  chat: ChatNode,
  message: MessageNode,
}
