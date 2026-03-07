import { createChatNode, createMessageNode } from "../layout";

export function makeChatNode(params: {
  id: string;
  position: { x: number; y: number };
  title: string;
}) {
  return createChatNode(params);
}

export function makeMessageNode(params: {
  id: string;
  chatId: string;
  indexInChat: number;
  role: "user" | "app";
  text: string;
}) {
  return createMessageNode(params);
}
