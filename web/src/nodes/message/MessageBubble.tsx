import type { ReactNode } from "react";
import { CHAT_PADDING, CHAT_WIDTH, MESSAGE_WIDTH } from "../../flow/layout";

type Props = {
  role: "user" | "app";
  text: string;
  selected: boolean;
  sourceHandle?: ReactNode;
};

export default function MessageBubble(props: Props) {
  const { role, text, selected, sourceHandle } = props;
  const isUser = role === "user";

  return (
    <div
      className={[
        "group relative flex flex-row items-center justify-between text-sm",
        isUser
          ? "rounded-xl border bg-(--msg-user-bg) border-(--msg-user-border) py-1 px-2 elev-1 text-(--msg-fg)"
          : "bg-transparent border-0 rounded-none py-1 px-0 text-(--msg-fg)",
        selected ? "ring-2 ring-(--selection-ring)" : "",
      ].join(" ")}
      style={{ width: isUser ? MESSAGE_WIDTH : CHAT_WIDTH - CHAT_PADDING * 2 }}
    >
      <p className="flex-1 whitespace-pre-wrap leading-snug flex items-center">
        {text}
      </p>
      {sourceHandle}
    </div>
  );
}
