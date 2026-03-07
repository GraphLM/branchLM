import type { ReactNode } from "react";
import { CHAT_PADDING, CHAT_WIDTH, MESSAGE_WIDTH } from "../../flow/layout";

type Props = {
  role: "user" | "app";
  text: string;
  selected: boolean;
  loading?: boolean;
  sourceHandle?: ReactNode;
};

export default function MessageBubble(props: Props) {
  const { role, text, loading = false, sourceHandle } = props;
  const isUser = role === "user";

  return (
    <div
      className={[
        "group relative flex flex-row items-center justify-between text-sm",
        isUser
          ? "rounded-xl border bg-(--msg-user-bg) border-(--msg-user-border) py-1 px-2 elev-1 text-(--msg-fg)"
          : "bg-transparent border-0 rounded-none py-1 px-0 text-(--msg-fg)",
      ].join(" ")}
      style={{ width: isUser ? MESSAGE_WIDTH : CHAT_WIDTH - CHAT_PADDING * 2 }}
    >
      {loading && !isUser && text.length === 0 ? (
        <div className="nodrag nopan flex flex-1 items-center gap-1 py-1 text-(--panel-muted)">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--panel-muted)" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--panel-muted) [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--panel-muted) [animation-delay:240ms]" />
        </div>
      ) : (
        <p className="nodrag nopan flex flex-1 cursor-text select-text items-center whitespace-pre-wrap break-words leading-snug">
          {text}
        </p>
      )}
      {sourceHandle}
    </div>
  );
}
