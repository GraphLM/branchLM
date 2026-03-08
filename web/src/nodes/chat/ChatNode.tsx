import { Handle, Position, useNodeConnections, type NodeProps } from "@xyflow/react";
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
  const hasPendingSource = props.pendingSourceMessageId != null;
  const incomingConnections = useNodeConnections({ id, handleType: "target" });
  const hasTargetConnection = incomingConnections.length > 0;

  return (
    <ChatCard
      title={data.title}
      draft={data.draft}
      focusToken={data.focusToken}
      webSearchEnabled={Boolean(data.webSearchEnabled)}
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
      onContextPreview={() => actions.openContextPreview(id)}
      onDraftChange={(nextDraft) => actions.updateChatDraft(id, nextDraft)}
      onToggleWebSearch={() => actions.toggleChatWebSearch(id)}
      onSend={() => actions.sendChatMessage(id)}
      onTitleCommit={(nextTitle) => {
        if (nextTitle !== data.title) actions.updateChatTitle(id, nextTitle);
      }}
    />
  );
}
