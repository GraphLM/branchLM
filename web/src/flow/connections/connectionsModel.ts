import { MarkerType, type Edge } from '@xyflow/react'

import type { FlowNode } from '../types'

export function buildContextEdgeId(sourceId: string, targetId: string): string {
  return `ctx:${sourceId}->${targetId}`
}

export function createContextEdge(params: {
  sourceId: string
  targetId: string
}): Edge {
  return {
    id: buildContextEdgeId(params.sourceId, params.targetId),
    source: params.sourceId,
    target: params.targetId,
    sourceHandle: null,
    targetHandle: null,
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
  }
}

export function isMessageToChatConnection(params: {
  sourceId: string
  targetId: string
  nodes: FlowNode[]
}): boolean {
  const sourceNode = params.nodes.find((node) => node.id === params.sourceId)
  const targetNode = params.nodes.find((node) => node.id === params.targetId)
  return sourceNode?.type === 'message' && targetNode?.type === 'chat'
}
