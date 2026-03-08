import ChatNode from "./chat/ChatNode";
import ContextNode from "./context/ContextNode";
import MessageNode from "./message/MessageNode";

// nodeTypes map used by FlowCanvas (XYFlow)
export const nodeTypes = {
  chat: ChatNode,
  context: ContextNode,
  message: MessageNode,
} as const;
