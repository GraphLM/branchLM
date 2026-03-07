import type { Node } from "@xyflow/react";

export type ChatNodeData = {
  title: string;
  draft: string;
  focusToken?: number;
  isSizeManual?: boolean;
};

export type MessageNodeData = {
  text: string;
  role: "user" | "app";
  ordinal: number;
  loading?: boolean;
};

export type ChatNode = Node<ChatNodeData, "chat">;
export type MessageNode = Node<MessageNodeData, "message">;

export type AppNode = ChatNode | MessageNode;
