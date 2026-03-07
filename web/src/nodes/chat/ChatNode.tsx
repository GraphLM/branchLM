import { Handle, NodeResizer, Position, useNodeConnections, useReactFlow, type NodeProps } from "@xyflow/react";
import { CHAT_MAX_HEIGHT, CHAT_MAX_WIDTH, CHAT_MIN_HEIGHT, CHAT_MIN_WIDTH } from "../../flow/layout";
import type { ChatNode } from "../../flow/types";
import { useFlowActions } from "../../flow/actionsContext";
import ChatCard from "./ChatCard";

type ExtraProps = {
  pendingSourceMessageId?: string | null;
  onChatTargetHandleActivate?: (chatId: string) => void;
  hoveredNodeId?: string | null;
};

export default function ChatNodeComponent(props: NodeProps<ChatNode> & ExtraProps) {
  const { id, data, selected, hoveredNodeId = null } = props;
  const actions = useFlowActions();
  const { setNodes } = useReactFlow<ChatNode>();
  const hasPendingSource = props.pendingSourceMessageId != null;
  const incomingConnections = useNodeConnections({ id, handleType: "target" });
  const hasTargetConnection = incomingConnections.length > 0;
  const applyManualSize = (width: number, height: number) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id || node.type !== "chat") return node;
        return {
          ...node,
          data: { ...node.data, isSizeManual: true },
          style: {
            ...(typeof node.style === "object" ? node.style : {}),
            width,
            height,
          },
        };
      }),
    );
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={CHAT_MIN_WIDTH}
        maxWidth={CHAT_MAX_WIDTH}
        minHeight={CHAT_MIN_HEIGHT}
        maxHeight={CHAT_MAX_HEIGHT}
        handleClassName="chat-node-resize-handle"
        lineClassName="chat-node-resize-line"
        onResize={(_event, params) => {
          applyManualSize(params.width, params.height);
        }}
        onResizeEnd={(_event, params) => {
          applyManualSize(params.width, params.height);
        }}
      />
      <ChatCard
        title={data.title}
        draft={data.draft}
        focusToken={data.focusToken}
        selected={selected}
        glow={hoveredNodeId === id}
        targetHandle={
          <Handle
            type="target"
            position={Position.Left}
            className={[
              "rf-handle-connect rf-handle-connect--target bg-(--handle-bg)! border-(--handle-border)! cursor-pointer",
              !hasPendingSource && !hasTargetConnection
                ? "opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
                : "",
              hasPendingSource
                ? "cursor-pointer ring-2 ring-(--focus-ring)"
                : "cursor-pointer",
            ].join(" ")}
            tabIndex={0}
            style={{ top: 24 }}
            title={
              hasPendingSource
                ? "Click to connect selected message"
                : "Drag from a message to connect"
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onChatTargetHandleActivate?.(id);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              props.onChatTargetHandleActivate?.(id);
            }}
          />
        }
        onDelete={() => actions.deleteChat(id)}
        onDraftChange={(nextDraft) => actions.updateChatDraft(id, nextDraft)}
        onSend={() => actions.sendChatMessage(id)}
        onTitleCommit={(nextTitle) => {
          if (nextTitle !== data.title) actions.updateChatTitle(id, nextTitle);
        }}
      />
    </>
  );
}
