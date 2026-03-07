import { useCallback, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
} from '@xyflow/react'

import { ChatNode } from '../../nodes/chat/ChatNode'
import { MessageNode } from '../../nodes/message/MessageNode'
import { Composer } from '../../ui/Composer'
import { useMessaging } from '../messaging/useMessaging'

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
    <div className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_12%_8%,var(--color-canvas-accent),var(--color-canvas-base)_55%)] text-[color:var(--color-text-primary)]">
      <div className="h-full w-full">
        <ReactFlow
          className="h-full w-full"
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
          <Background color="var(--color-grid)" gap={18} size={1.2} variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto">
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
      </div>
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
