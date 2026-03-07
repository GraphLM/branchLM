import { MarkerType, type Edge, type Connection } from "@xyflow/react";
import type { AppNode } from "../types";

export type UseConnectionsParams = {
  workspaceId: string;
  nodes: AppNode[];
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
};

export function buildContextEdgeId(sourceId: string, targetId: string): string {
  return `ctx:${sourceId}->${targetId}`;
}

export function isMessageToChatConnection(params: {
  sourceId: string;
  targetId: string;
  nodes: AppNode[];
}): boolean {
  const sourceNode = params.nodes.find((n) => n.id === params.sourceId);
  const targetNode = params.nodes.find((n) => n.id === params.targetId);
  return (
    (sourceNode?.type === "message" || sourceNode?.type === "context") &&
    targetNode?.type === "chat"
  );
}

export function createContextEdgeFromConnection(connection: Connection): Edge {
  return {
    ...connection,
    id: buildContextEdgeId(connection.source!, connection.target!),
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
  };
}

export function createContextEdge(params: { sourceId: string; targetId: string }): Edge {
  return {
    id: buildContextEdgeId(params.sourceId, params.targetId),
    source: params.sourceId,
    target: params.targetId,
    sourceHandle: null,
    targetHandle: null,
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
  };
}
