import { Send } from "lucide-react";

type Props = {
  onClick(): void;
  title?: string;
  className?: string;
};

export default function SendButton({ onClick, title = "Send", className = "" }: Props) {
  return (
    <button
      type="button"
      className={`group relative inline-flex items-center justify-center rounded-lg border border-transparent bg-transparent p-2 transition-colors hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover) ${className}`}
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Send
        size={14}
        className="text-(--panel-muted) group-hover:text-(--panel-fg)"
      />
    </button>
  );
}
