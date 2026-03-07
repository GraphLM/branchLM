import type { Node } from "@xyflow/react";

export type ChatNodeData = {
  title: string;
  draft: string;
};

export type MessageNodeData = {
  text: string;
  role: "user" | "app";
  ordinal: number;
};

export type ContextNodeData = {
  title: string;
  workspaceId: string;
  assetCount: number;
  statusText?: string;
};

export type ChatNode = Node<ChatNodeData, "chat">;
export type MessageNode = Node<MessageNodeData, "message">;
export type ContextNode = Node<ContextNodeData, "context">;

export type AppNode = ChatNode | MessageNode | ContextNode;
