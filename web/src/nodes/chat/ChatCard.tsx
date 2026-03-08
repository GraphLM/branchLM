import { useEffect, useRef, useState, type ReactNode } from "react";
import { BotMessageSquare } from "lucide-react";
import NodeDeleteButton from "../../ui/NodeDeleteButton";
import SendButton from "../../ui/SendButton";

type Props = {
  title: string;
  draft: string;
  selected: boolean;
  glow?: boolean;
  focusToken?: number;
  targetHandle?: ReactNode;
  onDelete(): void;
  onContextPreview(): void;
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
    focusToken,
    targetHandle,
    onDelete,
    onContextPreview,
    onDraftChange,
    onSend,
    onTitleCommit,
  } = props;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => {
    if (focusToken == null) return;
    const t = window.setTimeout(() => {
      draftInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [focusToken]);

  useEffect(() => {
    const el = draftInputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

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

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="relative rounded-lg border border-transparent bg-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
            title="Preview context"
            aria-label="Preview context"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onContextPreview();
            }}
          >
            <BotMessageSquare
              size={14}
              className="text-(--panel-muted) group-hover:text-(--panel-fg)"
            />
          </button>
          <NodeDeleteButton title="Delete chat" onClick={onDelete} />
        </div>
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

        <div className="absolute left-2 right-2 bottom-2 flex items-stretch rounded-xl border border-(--control-border) bg-(--control-bg) px-2 py-1">
          <textarea
            ref={draftInputRef}
            rows={1}
            className="nodrag nowheel max-h-40 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1 text-sm text-(--control-fg) placeholder:text-(--control-placeholder) focus:outline-none"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              e.stopPropagation();
              onSend();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Send a message…"
          />
          <SendButton onClick={onSend} className="self-stretch" />
        </div>
      </div>
    </div>
  );
}
