import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnNodeDrag,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  useReactFlow,
} from '@xyflow/react'

import { nodeTypes } from '../../nodes/nodeRegistry'
import {
  buildContextEdgeId,
  createContextEdge,
  isMessageToChatConnection,
} from '../connections/connectionsModel'
import { computeChatPosition } from '../layout'
import { Composer } from '../../ui/Composer'
import { useMessaging } from '../messaging/useMessaging'
import { messagingApi } from '../messaging/messagingApi'
import type { FlowNode } from '../types'
import { CanvasToolbar } from './CanvasToolbar'

function getClientPointFromEvent(
  event: MouseEvent | TouchEvent,
): { x: number; y: number } {
  if ('touches' in event && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  if ('changedTouches' in event && event.changedTouches.length > 0) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    }
  }
  const mouseEvent = event as MouseEvent
  return { x: mouseEvent.clientX, y: mouseEvent.clientY }
}

function CanvasInner() {
  const {
    nodes,
    composerText,
    isSubmitting,
    setComposerText,
    createChatFromComposer,
    createBranchChatFromMessage,
    onNodesChange,
    updateChatPosition,
    deleteNodeById,
  } = useMessaging()
  const { screenToFlowPosition } = useReactFlow()
  const [edges, setEdges] = useState<Edge[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const connectStartNodeIdRef = useRef<string | null>(null)

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedNodeIds = new Set(deletedNodes.map((node) => node.id))
      setEdges((prev) =>
        prev.filter((edge) => !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target)),
      )

      for (const node of deletedNodes) {
        void deleteNodeById(node.id)
      }
    },
    [deleteNodeById],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (isLocked) {
        return
      }

      if (!connection.source || !connection.target) {
        return
      }

      if (
        !isMessageToChatConnection({
          sourceId: connection.source,
          targetId: connection.target,
          nodes,
        })
      ) {
        return
      }

      const edgeId = buildContextEdgeId(connection.source, connection.target)
      setEdges((prev) => {
        if (prev.some((edge) => edge.id === edgeId)) {
          return prev
        }

        return addEdge(createContextEdge({ sourceId: connection.source!, targetId: connection.target! }), prev)
      })
    },
    [isLocked, nodes],
  )

  const handleConnectStart: OnConnectStart = useCallback((_event, nodeHandle) => {
    if (isLocked) {
      return
    }

    connectStartNodeIdRef.current = nodeHandle.nodeId
  }, [isLocked])

  const handleConnectEnd: OnConnectEnd = useCallback(
    async (event, connectionState) => {
      const fromNodeId = connectStartNodeIdRef.current
      connectStartNodeIdRef.current = null

      if (isLocked || !fromNodeId || connectionState.isValid === true) {
        return
      }

      const fromNode = nodes.find((node) => node.id === fromNodeId)
      if (!fromNode || fromNode.type !== 'message') {
        return
      }

      const nextChatId = await createBranchChatFromMessage({
        sourceMessageId: fromNodeId,
        position: screenToFlowPosition(getClientPointFromEvent(event)),
      })

      if (!nextChatId) {
        return
      }

      setEdges((prev) => addEdge(createContextEdge({ sourceId: fromNodeId, targetId: nextChatId }), prev))
    },
    [createBranchChatFromMessage, isLocked, nodes, screenToFlowPosition],
  )

  useEffect(() => {
    const availableNodeIds = new Set(nodes.map((node) => node.id))
    setEdges((prev) => {
      const filtered = prev.filter(
        (edge) => availableNodeIds.has(edge.source) && availableNodeIds.has(edge.target),
      )
      return filtered.length === prev.length ? prev : filtered
    })
  }, [nodes])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void messagingApi.saveGraphLayout({ nodes, edges })
    }, 500)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [nodes, edges])

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== 'chat') {
        return
      }

      updateChatPosition(node.id, node.position)
    },
    [updateChatPosition],
  )

  const handleAutoLayout = useCallback(() => {
    const chats = nodes
      .filter((node): node is Extract<FlowNode, { type: 'chat' }> => node.type === 'chat')
      .sort((a, b) => (a.position.x === b.position.x ? a.position.y - b.position.y : a.position.x - b.position.x))

    chats.forEach((chat, index) => {
      updateChatPosition(chat.id, computeChatPosition(index))
    })
  }, [nodes, updateChatPosition])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_12%_8%,var(--color-canvas-accent),var(--color-canvas-base)_55%)] text-[color:var(--color-text-primary)]">
      <div className="h-full w-full">
        <ReactFlow
          className="h-full w-full"
          defaultEdgeOptions={{
            style: { stroke: 'var(--color-text-secondary)' },
          }}
          deleteKeyCode={['Backspace', 'Delete']}
          edges={edges}
          fitView
          maxZoom={1.2}
          minZoom={0.5}
          nodeTypes={nodeTypes}
          onConnect={handleConnect}
          onConnectEnd={handleConnectEnd}
          onConnectStart={handleConnectStart}
          onEdgesChange={(changes) => {
            const removeIds = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id))
            if (removeIds.size === 0) {
              return
            }

            setEdges((prev) => prev.filter((edge) => !removeIds.has(edge.id)))
          }}
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodesDelete={handleNodesDelete}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable={!isLocked}
          panOnDrag={!isLocked}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--color-grid)" gap={18} size={1.2} variant={BackgroundVariant.Dots} />
          <CanvasToolbar
            locked={isLocked}
            onAutoLayout={handleAutoLayout}
            onLockToggle={() => setIsLocked((prev) => !prev)}
          />
        </ReactFlow>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-none">
          <Composer
            disabled={isSubmitting}
            onChange={setComposerText}
            onSubmit={() => {
              void createChatFromComposer()
            }}
            placeholder="Create chat with first message"
            value={composerText}
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
