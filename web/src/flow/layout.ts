import type { AppNode, ChatNode, ContextNode, MessageNode } from "./types";

export const CHAT_WIDTH = 440;
export const CHAT_MIN_HEIGHT = 360;
export const CHAT_HEADER_HEIGHT = 46;
export const CHAT_INPUT_HEIGHT = 66;
export const CHAT_PADDING = 14;
export const CHAT_FOOTER_PADDING = 14;

export const MESSAGE_WIDTH = 300;
export const MESSAGE_HEIGHT = 62;
export const MESSAGE_GAP_Y = -15;
export const CONTEXT_NODE_WIDTH = 300;
export const CONTEXT_NODE_HEIGHT = 180;

export function getMessagePosition(params: {
  indexInChat: number;
  role: "user" | "app";
}): { x: number; y: number } {
  const baseY = CHAT_HEADER_HEIGHT + CHAT_PADDING;
  const y = baseY + params.indexInChat * (MESSAGE_HEIGHT + MESSAGE_GAP_Y);

  const xLeft = CHAT_PADDING;
  const xRight = CHAT_WIDTH - CHAT_PADDING - MESSAGE_WIDTH;
  const x = params.role === "user" ? xRight : xLeft;

  return { x, y };
}

export function computeChatHeight(messageCount: number): number {
  if (messageCount <= 0) return CHAT_MIN_HEIGHT;

  const baseY = CHAT_HEADER_HEIGHT + CHAT_PADDING;
  const lastMessageBottom =
    baseY +
    (messageCount - 1) * (MESSAGE_HEIGHT + MESSAGE_GAP_Y) +
    MESSAGE_HEIGHT;

  const needed = lastMessageBottom + CHAT_FOOTER_PADDING + CHAT_INPUT_HEIGHT;
  return Math.max(CHAT_MIN_HEIGHT, needed);
}

const CHAT_GRID_COL_GAP = 24;
const CHAT_GRID_ROW_GAP = 24;
const CHAT_GRID_ROW_HEIGHT = 420;

export function layoutChatNodesInGrid(nodes: AppNode[]): AppNode[] {
  const chatNodes = nodes
    .filter((n): n is ChatNode => n.type === "chat")
    .sort((a, b) => a.id.localeCompare(b.id));

  if (chatNodes.length === 0) return nodes;

  const cols = 2;
  const positionByChatId = new Map<string, { x: number; y: number }>();
  chatNodes.forEach((chat, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positionByChatId.set(chat.id, {
      x: col * (CHAT_WIDTH + CHAT_GRID_COL_GAP),
      y: row * (CHAT_GRID_ROW_HEIGHT + CHAT_GRID_ROW_GAP),
    });
  });

  return nodes.map((n) => {
    if (n.type !== "chat") return n;
    const pos = positionByChatId.get(n.id);
    if (!pos) return n;
    return { ...n, position: pos };
  });
}

export function createChatNode(params: {
  id: string;
  position: { x: number; y: number };
  title: string;
}): ChatNode {
  return {
    id: params.id,
    type: "chat",
    position: params.position,
    data: { title: params.title, draft: "" },
    style: { width: CHAT_WIDTH, height: CHAT_MIN_HEIGHT },
    dragHandle: ".chat-drag-handle",
    zIndex: 0,
  };
}

export function createMessageNode(params: {
  id: string;
  chatId: string;
  indexInChat: number;
  role: "user" | "app";
  text: string;
}): MessageNode {
  const position = getMessagePosition({
    indexInChat: params.indexInChat,
    role: params.role,
  });

  return {
    id: params.id,
    type: "message",
    parentId: params.chatId,
    extent: "parent",
    position,
    data: { text: params.text, role: params.role, ordinal: params.indexInChat },
    draggable: false,
    zIndex: 1,
  };
}

export function createContextNode(params: {
  id: string;
  workspaceId: string;
  position: { x: number; y: number };
  title: string;
  assetCount?: number;
  statusText?: string;
}): ContextNode {
  return {
    id: params.id,
    type: "context",
    position: params.position,
    data: {
      title: params.title,
      workspaceId: params.workspaceId,
      assetCount: params.assetCount ?? 0,
      statusText: params.statusText,
    },
    style: { width: CONTEXT_NODE_WIDTH, height: CONTEXT_NODE_HEIGHT },
    dragHandle: ".context-drag-handle",
    zIndex: 0,
  };
}
