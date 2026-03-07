import { Handle, Position, useNodeConnections, type NodeProps } from "@xyflow/react";
import type { MessageNode } from "../../flow/types";
import MessageBubble from "./MessageBubble";

type ExtraProps = {
  pendingSourceMessageId?: string | null;
  onMessageSourceHandleActivate?: (messageId: string) => void;
};

export default function MessageNodeComponent(
  props: NodeProps<MessageNode> & ExtraProps,
) {
  const { id, data, selected } = props;
  const isPendingSource = props.pendingSourceMessageId === id;
  const outgoingConnections = useNodeConnections({ id, handleType: "source" });
  const hasSourceConnection = outgoingConnections.length > 0;

  return (
    <MessageBubble
      role={data.role}
      text={data.text}
      selected={selected}
      loading={data.loading}
      sourceHandle={
        <Handle
          type="source"
          position={Position.Right}
          className={[
            "rf-handle-connect rf-handle-connect--source bg-(--handle-bg)! border-(--handle-border)! cursor-pointer",
            !isPendingSource && !hasSourceConnection
              ? "opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
              : "",
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
