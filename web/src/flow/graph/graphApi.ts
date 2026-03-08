import type { Edge } from "@xyflow/react";
import { apiFetch } from "../../lib/api";
import type { AppNode } from "../types";
import {
  buildChatPositions,
  buildContextEdgesForSave,
  buildContextNodeEdgesForSave,
  buildContextNodePositions,
} from "./graphModel";

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

export type GraphContextNodeDTO = {
  id: string;
  workspaceId: string;
  title: string;
  position: { x: number; y: number };
  assetCount?: number;
  status?: string | null;
  statusMessage?: string | null;
  sourceFileName?: string | null;
  sourceMimeType?: string | null;
};

export type GraphContextNodeEdgeDTO = {
  fromContextNodeId: string;
  toChatId: string;
  rank: number;
};

export type GraphDTO = {
  chats: GraphChatDTO[];
  messages: GraphMessageDTO[];
  contextEdges: GraphContextEdgeDTO[];
  contextNodes: GraphContextNodeDTO[];
  contextNodeEdges: GraphContextNodeEdgeDTO[];
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
  const res = await apiFetch(`/api/workspaces/${params.workspaceId}/graph/layout`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chatPositions: buildChatPositions(params.nodes),
      contextNodePositions: buildContextNodePositions(params.nodes),
      contextEdges: buildContextEdgesForSave({
        nodes: params.nodes,
        edges: params.edges,
      }),
      contextNodeEdges: buildContextNodeEdgesForSave({
        nodes: params.nodes,
        edges: params.edges,
      }),
    }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
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

export async function createContextNode(params: {
  workspaceId: string;
  title: string;
  position: { x: number; y: number };
}): Promise<GraphContextNodeDTO | null> {
  const res = await apiFetch(`/api/workspaces/${params.workspaceId}/context-nodes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title, position: params.position }),
  });
  if (!res.ok) return null;
  return (await res.json()) as GraphContextNodeDTO;
}

export async function deleteContextNode(params: {
  workspaceId: string;
  contextNodeId: string;
}): Promise<void> {
  await apiFetch(
    `/api/workspaces/${params.workspaceId}/context-nodes/${params.contextNodeId}`,
    { method: "DELETE" },
  );
}

export async function updateContextNodeTitle(params: {
  workspaceId: string;
  contextNodeId: string;
  title: string;
}): Promise<void> {
  await apiFetch(
    `/api/workspaces/${params.workspaceId}/context-nodes/${params.contextNodeId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: params.title }),
    },
  );
}

export type ContextNodeAssetDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  statusMessage?: string | null;
};

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
  } catch {
    // ignore parse error
  }
  return `Request failed (${res.status})`;
}

export async function uploadContextNodeAsset(params: {
  workspaceId: string;
  contextNodeId: string;
  file: File;
  replace?: boolean;
}): Promise<ContextNodeAssetDTO> {
  const form = new FormData();
  form.append("file", params.file);
  const query = params.replace ? "?replace=true" : "";
  const res = await apiFetch(
    `/api/workspaces/${params.workspaceId}/context-nodes/${params.contextNodeId}/assets${query}`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
  return (await res.json()) as ContextNodeAssetDTO;
}

export async function uploadContextNodeTextAsset(params: {
  workspaceId: string;
  contextNodeId: string;
  text: string;
  replace?: boolean;
}): Promise<ContextNodeAssetDTO> {
  const query = params.replace ? "?replace=true" : "";
  const res = await apiFetch(
    `/api/workspaces/${params.workspaceId}/context-nodes/${params.contextNodeId}/text${query}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: params.text }),
    },
  );
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res));
  }
  return (await res.json()) as ContextNodeAssetDTO;
}
