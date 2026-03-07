import { Trash2 } from "lucide-react";

type Props = {
  onClick(): void;
  title?: string;
};

export default function NodeDeleteButton({ onClick, title = "Delete" }: Props) {
  return (
    <button
      type="button"
      className="relative rounded-md border border-transparent bg-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
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
      <Trash2
        size={14}
        className="text-(--panel-muted) group-hover:text-(--panel-fg)"
      />
    </button>
  );
}
