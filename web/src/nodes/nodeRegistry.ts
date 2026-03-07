import ChatNode from "./chat/ChatNode";
import MessageNode from "./message/MessageNode";

// nodeTypes map used by FlowCanvas (XYFlow)
export const nodeTypes = {
  chat: ChatNode,
  message: MessageNode,
} as const;