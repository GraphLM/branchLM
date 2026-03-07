import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  MarkerType,
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
  type NodeTypes,
  useReactFlow,
} from '@xyflow/react'

import { ChatNode } from '../../nodes/chat/ChatNode'
import { MessageNode } from '../../nodes/message/MessageNode'
import { Composer } from '../../ui/Composer'
import { useMessaging } from '../messaging/useMessaging'

const nodeTypes: NodeTypes = {
  chat: ChatNode,
  message: MessageNode,
}

function buildContextEdgeId(sourceId: string, targetId: string): string {
  return `ctx:${sourceId}->${targetId}`
}

function createContextEdge(params: { sourceId: string; targetId: string }): Edge {
  return {
    id: buildContextEdgeId(params.sourceId, params.targetId),
    source: params.sourceId,
    target: params.targetId,
    sourceHandle: null,
    targetHandle: null,
    markerEnd: { type: MarkerType.ArrowClosed },
  }
}

function CanvasInner() {
  const messaging = useMessaging()
  const { screenToFlowPosition } = useReactFlow()
  const [edges, setEdges] = useState<Edge[]>([])
  const connectStartNodeIdRef = useRef<string | null>(null)

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedNodeIds = new Set(deletedNodes.map((node) => node.id))
      setEdges((prev) =>
        prev.filter((edge) => !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target)),
      )

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

  const isMessageToChatConnection = useCallback(
    (params: { sourceId: string; targetId: string }) => {
      const sourceNode = messaging.nodes.find((node) => node.id === params.sourceId)
      const targetNode = messaging.nodes.find((node) => node.id === params.targetId)
      return sourceNode?.type === 'message' && targetNode?.type === 'chat'
    },
    [messaging.nodes],
  )

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }

      if (!isMessageToChatConnection({ sourceId: connection.source, targetId: connection.target })) {
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
    [isMessageToChatConnection],
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

      const fromNode = messaging.nodes.find((node) => node.id === fromNodeId)
      if (!fromNode || fromNode.type !== 'message') {
        return
      }

      const clientPoint =
        'touches' in event && event.touches.length > 0
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : 'changedTouches' in event && event.changedTouches.length > 0
            ? {
                x: event.changedTouches[0].clientX,
                y: event.changedTouches[0].clientY,
              }
            : {
                x: (event as MouseEvent).clientX,
                y: (event as MouseEvent).clientY,
              }

      const nextChatId = await messaging.createBranchChatFromMessage({
        sourceMessageId: fromNodeId,
        position: screenToFlowPosition(clientPoint),
      })

      if (!nextChatId) {
        return
      }

      setEdges((prev) => addEdge(createContextEdge({ sourceId: fromNodeId, targetId: nextChatId }), prev))
    },
    [messaging, screenToFlowPosition],
  )

  useEffect(() => {
    const availableNodeIds = new Set(messaging.nodes.map((node) => node.id))
    setEdges((prev) =>
      prev.filter((edge) => availableNodeIds.has(edge.source) && availableNodeIds.has(edge.target)),
    )
  }, [messaging.nodes])

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== 'chat') {
        return
      }

      messaging.updateChatPosition(node.id, node.position)
    },
    [messaging],
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

            setEdges((prev) => prev.filter((edge) => !removeIds.has(edge.id)))
          }}
          nodes={sortedNodes}
          onNodesChange={messaging.onNodesChange}
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
