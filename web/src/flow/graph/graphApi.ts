import type { Edge } from "@xyflow/react";
import { apiFetch } from "../../lib/api";
import type { AppNode } from "../types";
import { buildChatPositions, buildContextEdgesForSave } from "./graphModel";

export type GraphChatDTO = {
  id: string;
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
  signal: AbortSignal;
}): Promise<GraphDTO | null> {
  const res = await apiFetch("/api/graph", {
    signal: params.signal,
  });
  if (!res.ok) return null;
  return (await res.json()) as GraphDTO;
}

export async function saveGraphLayout(params: {
  nodes: AppNode[];
  edges: Edge[];
}): Promise<void> {
  await apiFetch("/api/graph/layout", {
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
  chatId: string;
}): Promise<void> {
  await apiFetch(`/api/chats/${params.chatId}`, {
    method: "DELETE",
  });
}

export async function deleteMessage(params: {
  messageId: string;
}): Promise<void> {
  await apiFetch(`/api/messages/${params.messageId}`, {
    method: "DELETE",
  });
}
