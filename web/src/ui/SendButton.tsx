import { Send } from "lucide-react";

type Props = {
  onClick(): void;
  title?: string;
};

export default function SendButton({ onClick, title = "Send" }: Props) {
  return (
    <button
      type="button"
      className="relative rounded-lg border border-transparent bg-transparent p-2 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
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
