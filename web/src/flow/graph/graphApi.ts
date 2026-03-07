import type { Edge } from "@xyflow/react";
import { apiFetch } from "../../lib/api";
import type { AppNode } from "../types";
import { buildChatPositions, buildContextEdgesForSave } from "./graphModel";

export type GraphChatDTO = {
  id: string;
  workspaceId: string;
  title: string;
  position: { x: number; y: number };
};

export type GraphMessageDTO = {
  id: string;
  chatId: string;
  ordinal: number;
  role: "user" | "app";
  text: string;
};

export type GraphContextEdgeDTO = {
  fromMessageId: string;
  toChatId: string;
  rank: number;
};

export type GraphDTO = {
  chats: GraphChatDTO[];
  messages: GraphMessageDTO[];
  contextEdges: GraphContextEdgeDTO[];
};

export async function fetchGraph(params: {
  workspaceId: string;
  signal: AbortSignal;
}): Promise<GraphDTO | null> {
  const res = await apiFetch(`/api/workspaces/${params.workspaceId}/graph`, {
    signal: params.signal,
  });
  if (!res.ok) return null;
  return (await res.json()) as GraphDTO;
}

export async function saveGraphLayout(params: {
  workspaceId: string;
  nodes: AppNode[];
  edges: Edge[];
}): Promise<void> {
  await apiFetch(`/api/workspaces/${params.workspaceId}/graph/layout`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chatPositions: buildChatPositions(params.nodes),
      contextEdges: buildContextEdgesForSave({
        nodes: params.nodes,
        edges: params.edges,
      }),
    }),
  });
}

export async function deleteChat(params: {
  workspaceId: string;
  chatId: string;
}): Promise<void> {
  await apiFetch(`/api/workspaces/${params.workspaceId}/chats/${params.chatId}`, {
    method: "DELETE",
  });
}

export async function deleteMessage(params: {
  workspaceId: string;
  messageId: string;
}): Promise<void> {
  await apiFetch(`/api/workspaces/${params.workspaceId}/messages/${params.messageId}`, {
    method: "DELETE",
  });
}
