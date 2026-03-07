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
import { Composer } from '../../ui/Composer'
import { useMessaging } from '../messaging/useMessaging'

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
    initialEdges,
    composerText,
    isSubmitting,
    setComposerText,
    createChatFromComposer,
    createBranchChatFromMessage,
    onNodesChange,
    updateChatPosition,
    syncContextEdges,
    deleteNodeById,
  } = useMessaging()
  const { screenToFlowPosition } = useReactFlow()
  const [edges, setEdges] = useState<Edge[]>([])
  const connectStartNodeIdRef = useRef<string | null>(null)

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges])

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedNodeIds = new Set(deletedNodes.map((node) => node.id))
      setEdges((prev) => {
        const nextEdges = prev.filter(
          (edge) => !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target),
        )
        syncContextEdges(nextEdges)
        return nextEdges
      })

      for (const node of deletedNodes) {
        void deleteNodeById(node.id)
      }
    },
    [deleteNodeById, syncContextEdges],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
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

        const nextEdges = addEdge(
          createContextEdge({ sourceId: connection.source!, targetId: connection.target! }),
          prev,
        )
        syncContextEdges(nextEdges)
        return nextEdges
      })
    },
    [nodes, syncContextEdges],
  )

  const handleConnectStart: OnConnectStart = useCallback((_event, nodeHandle) => {
    connectStartNodeIdRef.current = nodeHandle.nodeId
  }, [])

  const handleConnectEnd: OnConnectEnd = useCallback(
    async (event, connectionState) => {
      const fromNodeId = connectStartNodeIdRef.current
      connectStartNodeIdRef.current = null

      if (!fromNodeId || connectionState.isValid === true) {
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

      setEdges((prev) => {
        const nextEdges = addEdge(createContextEdge({ sourceId: fromNodeId, targetId: nextChatId }), prev)
        syncContextEdges(nextEdges)
        return nextEdges
      })
    },
    [createBranchChatFromMessage, nodes, screenToFlowPosition, syncContextEdges],
  )

  useEffect(() => {
    const availableNodeIds = new Set(nodes.map((node) => node.id))
    setEdges((prev) => {
      const filtered = prev.filter(
        (edge) => availableNodeIds.has(edge.source) && availableNodeIds.has(edge.target),
      )
      if (filtered.length !== prev.length) {
        syncContextEdges(filtered)
      }
      return filtered.length === prev.length ? prev : filtered
    })
  }, [nodes, syncContextEdges])

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== 'chat') {
        return
      }

      updateChatPosition(node.id, node.position)
    },
    [updateChatPosition],
  )

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

            setEdges((prev) => {
              const nextEdges = prev.filter((edge) => !removeIds.has(edge.id))
              syncContextEdges(nextEdges)
              return nextEdges
            })
          }}
          nodes={nodes}
          onNodesChange={onNodesChange}
          onNodesDelete={handleNodesDelete}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--color-grid)" gap={18} size={1.2} variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto">
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
