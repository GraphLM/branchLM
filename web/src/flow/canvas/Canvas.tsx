import { useCallback, useMemo } from 'react'
import { Background, ReactFlow, ReactFlowProvider, type Node, type NodeTypes } from '@xyflow/react'

import { useMessaging } from '../messaging/useMessaging'
import { ChatNode } from '../../nodes/chat/ChatNode'
import { MessageNode } from '../../nodes/message/MessageNode'
import { Composer } from '../../ui/Composer'

const nodeTypes: NodeTypes = {
  chat: ChatNode,
  message: MessageNode,
}

function CanvasInner() {
  const messaging = useMessaging()

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        void messaging.deleteNodeById(node.id)
      }
    },
    [messaging],
  )

  const sortedNodes = useMemo(() => {
    return [...messaging.nodes].sort((a, b) => {
      if (a.type === b.type) {
        return a.id.localeCompare(b.id)
      }

      return a.type === 'chat' ? -1 : 1
    })
  }, [messaging.nodes])

  return (
    <div className="canvas-page">
      <div className="canvas-surface">
        <ReactFlow
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          maxZoom={1.2}
          minZoom={0.5}
          nodeTypes={nodeTypes}
          nodes={sortedNodes}
          onNodesDelete={handleNodesDelete}
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--color-grid)" gap={24} />
        </ReactFlow>
      </div>

      <Composer
        disabled={messaging.isSubmitting}
        onChange={messaging.setComposerText}
        onSubmit={() => {
          void messaging.createChatFromComposer()
        }}
        placeholder="Create chat with first message"
        value={messaging.composerText}
      />
    </div>
  )
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
