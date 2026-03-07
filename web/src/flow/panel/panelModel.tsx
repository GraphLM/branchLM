import type { ReactElement } from "react";
import type { NodeProps } from "@xyflow/react";
import ChatNode from "../../nodes/chat/ChatNode";
import MessageNode from "../../nodes/message/MessageNode";
import type {
  ChatNode as ChatFlowNode,
  MessageNode as MessageFlowNode,
} from "../types";

export function createNodeTypes(params: {
  hoveredNodeId: string | null;
  pendingSourceMessageId: string | null;
  onChatTargetHandleActivate: (chatId: string) => void;
  onMessageSourceHandleActivate: (messageId: string) => void;
}): {
  chat: (props: NodeProps<ChatFlowNode>) => ReactElement;
  message: (props: NodeProps<MessageFlowNode>) => ReactElement;
} {
  return {
    chat: (props: NodeProps<ChatFlowNode>): ReactElement => (
      <ChatNode
        {...props}
        hoveredNodeId={params.hoveredNodeId}
        pendingSourceMessageId={params.pendingSourceMessageId}
        onChatTargetHandleActivate={params.onChatTargetHandleActivate}
      />
    ),
    message: (props: NodeProps<MessageFlowNode>): ReactElement => (
      <MessageNode
        {...props}
        pendingSourceMessageId={params.pendingSourceMessageId}
        onMessageSourceHandleActivate={params.onMessageSourceHandleActivate}
      />
    ),
  };
}

export function focusNodeInView(params: {
  getNode: (id: string) =>
    | ({
        measured?: { width?: number; height?: number };
        width?: number;
        height?: number;
        position: { x: number; y: number };
      } & Record<string, unknown>)
    | undefined;
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => void;
  nodeId: string;
}) {
  const node = params.getNode(params.nodeId);
  if (!node) return;

  const width = node.measured?.width ?? node.width ?? 0;
  const height = node.measured?.height ?? node.height ?? 0;
  const pos =
    (node as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute ??
    (node as unknown as { internals?: { positionAbsolute?: { x: number; y: number } } }).internals
      ?.positionAbsolute ??
    node.position;

  params.setCenter(pos.x + width / 2, pos.y + height / 2, {
    zoom: 1.3,
    duration: 400,
  });
}
