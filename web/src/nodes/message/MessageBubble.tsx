import type { ReactNode } from "react";
import { MESSAGE_WIDTH } from "../../flow/layout";
import NodeDeleteButton from "../../ui/NodeDeleteButton";

type Props = {
  role: "user" | "app";
  text: string;
  selected: boolean;
  sourceHandle?: ReactNode;
  onDelete(): void;
};

export default function MessageBubble(props: Props) {
  const { role, text, selected, sourceHandle, onDelete } = props;
  const isUser = role === "user";

  return (
    <div
      className={[
        "group flex flex-row items-center justify-between relative rounded-xl border py-1 px-2 elev-1 text-sm",
        isUser
          ? "bg-(--msg-user-bg) border-(--msg-user-border) text-(--msg-fg)"
          : "bg-(--msg-app-bg) border-(--msg-app-border) text-(--msg-fg)",
        selected ? "ring-2 ring-(--selection-ring)" : "",
      ].join(" ")}
      style={{ width: MESSAGE_WIDTH }}
    >
      <p className="flex-1 whitespace-pre-wrap leading-snug flex items-center">
        {text}
      </p>
      <div className="flex items-center">
        <NodeDeleteButton title="Delete message" onClick={onDelete} />
      </div>
      {sourceHandle}
    </div>
  );
}
