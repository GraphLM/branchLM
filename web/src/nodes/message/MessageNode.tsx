import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MessageNode } from "../../flow/types";
import { useFlowActions } from "../../flow/actionsContext";
import MessageBubble from "./MessageBubble";

type ExtraProps = {
  pendingSourceMessageId?: string | null;
  onMessageSourceHandleActivate?: (messageId: string) => void;
};

export default function MessageNodeComponent(
  props: NodeProps<MessageNode> & ExtraProps,
) {
  const { id, data, selected } = props;
  const actions = useFlowActions();
  const isPendingSource = props.pendingSourceMessageId === id;

  return (
    <MessageBubble
      role={data.role}
      text={data.text}
      selected={selected}
      onDelete={() => actions.deleteMessage(id)}
      sourceHandle={
        <Handle
          type="source"
          position={Position.Right}
          className={[
            "rf-handle-connect rf-handle-connect--source bg-(--handle-bg)! border-(--handle-border)! cursor-pointer",
            isPendingSource
              ? "rf-handle-connect--active ring-2 ring-(--selection-ring) border-(--selection-border)!"
              : "",
          ].join(" ")}
          tabIndex={0}
          title="Click, then click a chat to connect"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            props.onMessageSourceHandleActivate?.(id);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            props.onMessageSourceHandleActivate?.(id);
          }}
        />
      }
    />
  );
}
