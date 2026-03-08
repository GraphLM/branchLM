import { type Edge } from "@xyflow/react";
import {
  CHAT_FOOTER_PADDING,
  CHAT_HEADER_HEIGHT,
  CHAT_MIN_HEIGHT,
  CHAT_PADDING,
  MESSAGE_GAP_Y,
  estimateChatInputHeight,
  estimateMessageHeight,
  getMessagePosition,
} from "../layout";
import type { AppNode, MessageNode as MessageFlowNode } from "../types";

export function buildChatPositions(nodes: AppNode[]): Record<string, { x: number; y: number }> {
  const chatPositions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    if (n.type !== "chat") continue;
    chatPositions[n.id] = { x: n.position.x, y: n.position.y };
  }
  return chatPositions;
}

export function buildContextNodePositions(
  nodes: AppNode[],
): Record<string, { x: number; y: number }> {
  const contextNodePositions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    if (n.type !== "context") continue;
    contextNodePositions[n.id] = { x: n.position.x, y: n.position.y };
  }
  return contextNodePositions;
}

export function applyAutoLayout(nodes: AppNode[]): AppNode[] {
  const messagesByChat = new Map<string, MessageFlowNode[]>();
  for (const n of nodes) {
    if (n.type !== "message") continue;
    if (!n.parentId) continue;
    const list = messagesByChat.get(n.parentId) ?? [];
    list.push(n as MessageFlowNode);
    messagesByChat.set(n.parentId, list);
  }

  const messageLayout = new Map<string, { position: { x: number; y: number } }>();
  const messageBottomByChat = new Map<string, number>();

  for (const [chatId, msgs] of messagesByChat.entries()) {
    const sorted = msgs.slice().sort((a, b) => a.data.ordinal - b.data.ordinal);
    const baseY = CHAT_HEADER_HEIGHT + CHAT_PADDING;
    let offsetY = 0;

    sorted.forEach((m) => {
      const estimatedHeight = estimateMessageHeight({ text: m.data.text, role: m.data.role });
      const x = getMessagePosition({ indexInChat: 0, role: m.data.role }).x;
      messageLayout.set(m.id, {
        position: { x, y: baseY + offsetY },
      });
      offsetY += estimatedHeight + MESSAGE_GAP_Y;
    });

    const messageContentBottom = baseY + Math.max(0, offsetY - MESSAGE_GAP_Y);
    messageBottomByChat.set(chatId, messageContentBottom);
  }

  return nodes.map((n) => {
    if (n.type === "message") {
      const layout = messageLayout.get(n.id);
      if (!layout) return { ...n, draggable: false };
      return { ...n, position: layout.position, draggable: false };
    }

    if (n.type === "chat") {
      const inputHeight = estimateChatInputHeight(n.data.draft);
      const messageContentBottom = messageBottomByChat.get(n.id) ?? CHAT_HEADER_HEIGHT + CHAT_PADDING;
      const contentDrivenHeight = messageContentBottom + CHAT_FOOTER_PADDING + inputHeight;
      const style = {
        ...(typeof n.style === "object" ? n.style : {}),
        height: Math.max(CHAT_MIN_HEIGHT, contentDrivenHeight),
      };
      return { ...n, style };
    }

    return n;
  });
}

export function collectCascadeRemoval(nodes: AppNode[], seedNodeIds: Set<string>): {
  removedChatIds: Set<string>;
  removedMessageIds: Set<string>;
  removedAllIds: Set<string>;
} {
  const removedChatIds = new Set(
    nodes.filter((n) => seedNodeIds.has(n.id) && n.type === "chat").map((n) => n.id),
  );

  const removedMessageIds = new Set(
    nodes
      .filter(
        (n) =>
          (seedNodeIds.has(n.id) && n.type === "message") ||
          (n.type === "message" && n.parentId && removedChatIds.has(n.parentId)),
      )
      .map((n) => n.id),
  );

  return {
    removedChatIds,
    removedMessageIds,
    removedAllIds: new Set<string>([
      ...seedNodeIds,
      ...removedChatIds,
      ...removedMessageIds,
    ]),
  };
}

export function buildContextEdgesForSave(params: {
  nodes: AppNode[];
  edges: Edge[];
}): Array<{ fromMessageId: string; toChatId: string; rank: number }> {
  const typeById = new Map(params.nodes.map((n) => [n.id, n.type] as const));
  const nextRankByToChat = new Map<string, number>();
  const seenPairs = new Set<string>();

  return params.edges
    .filter(
      (e) => typeById.get(e.source) === "message" && typeById.get(e.target) === "chat",
    )
    .filter((e) => {
      const key = `${e.source}->${e.target}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .map((e) => {
      const current = nextRankByToChat.get(e.target) ?? 0;
      nextRankByToChat.set(e.target, current + 1);
      return { fromMessageId: e.source, toChatId: e.target, rank: current };
    });
}

export function buildContextNodeEdgesForSave(params: {
  nodes: AppNode[];
  edges: Edge[];
}): Array<{ fromContextNodeId: string; toChatId: string; rank: number }> {
  const typeById = new Map(params.nodes.map((n) => [n.id, n.type] as const));
  const nextRankByToChat = new Map<string, number>();
  const seenPairs = new Set<string>();

  return params.edges
    .filter((e) => typeById.get(e.source) === "context" && typeById.get(e.target) === "chat")
    .filter((e) => {
      const key = `${e.source}->${e.target}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .map((e) => {
      const current = nextRankByToChat.get(e.target) ?? 0;
      nextRankByToChat.set(e.target, current + 1);
      return { fromContextNodeId: e.source, toChatId: e.target, rank: current };
    });
}

export function styleRenderedEdges(params: {
  edges: Edge[];
  hoveredEdgeId: string | null;
}): Edge[] {
  return params.edges.map((e) => {
    const isHovered = params.hoveredEdgeId != null && e.id === params.hoveredEdgeId;
    const isSelected = e.selected === true;
    const strokeWidth = isSelected ? 3.25 : isHovered ? 2.5 : 1.5;

    return {
      ...e,
      zIndex: isSelected ? 5 : e.zIndex,
      style: {
        ...(typeof e.style === "object" ? e.style : {}),
        strokeWidth,
        ...(isSelected
          ? {
              stroke: "var(--accent-strong)",
              filter: "drop-shadow(0 0 6px var(--edge-selected-glow))",
            }
          : {}),
      },
    };
  });
}
