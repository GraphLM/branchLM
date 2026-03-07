import { useEffect, useRef, useState, type ReactNode } from "react";
import NodeDeleteButton from "../../ui/NodeDeleteButton";
import SendButton from "../../ui/SendButton";

type Props = {
  title: string;
  draft: string;
  selected: boolean;
  glow?: boolean;
  targetHandle?: ReactNode;
  onDelete(): void;
  onDraftChange(nextDraft: string): void;
  onSend(): void;
  onTitleCommit(nextTitle: string): void;
};

export default function ChatCard(props: Props) {
  const {
    title,
    draft,
    selected,
    glow = false,
    targetHandle,
    onDelete,
    onDraftChange,
    onSend,
    onTitleCommit,
  } = props;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(title);
  }, [title, isEditingTitle]);

  useEffect(() => {
    if (!isEditingTitle) return;
    const t = window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isEditingTitle]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next.length === 0) {
      setTitleDraft(title);
      setIsEditingTitle(false);
      return;
    }
    onTitleCommit(next);
    setIsEditingTitle(false);
  };

  const cancelTitle = () => {
    setTitleDraft(title);
    setIsEditingTitle(false);
  };

  return (
    <div className="group relative flex h-full flex-col chat-drag-handle">
      <div className="flex justify-between items-center w-full px-2 py-1 cursor-grab">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="truncate rounded-lg border border-transparent px-1 text-sm font-semibold cursor-text focus:outline-none focus:ring-1 focus:ring-(--focus-ring) focus:border-(--control-border)"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => commitTitle()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") cancelTitle();
            }}
          />
        ) : (
          <button
            type="button"
            className="text-left text-sm font-semibold text-(--panel-fg) truncate hover:cursor-text"
            onClick={() => setIsEditingTitle(true)}
            title="Rename chat"
          >
            {title}
          </button>
        )}

        <NodeDeleteButton title="Delete chat" onClick={onDelete} />
      </div>

      <div
        className={[
          "group relative h-full w-full overflow-visible rounded-2xl border bg-(--chat-bg) text-(--msg-fg) elev-2 backdrop-blur",
          selected
            ? "border-(--selection-border) ring-2 ring-(--selection-ring)"
            : glow
              ? "border-(--control-border-hover) ring-1 ring-(--surface-hover-ring)"
              : "border-(--chat-border)",
        ].join(" ")}
      >
        {targetHandle}

        <div className="absolute left-0 right-0 bottom-0 px-2 py-2">
          <div className="flex gap-2">
            <input
              className="nodrag flex-1 rounded-xl border border-(--control-border) bg-(--control-bg) px-2 py-1 text-sm text-(--control-fg) placeholder:text-(--control-placeholder) focus:outline-none focus:ring-2 focus:ring-(--focus-ring)"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Send a message…"
            />
            <SendButton onClick={onSend} />
          </div>
        </div>
      </div>
    </div>
  );
}
