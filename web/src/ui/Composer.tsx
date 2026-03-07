import { useCallback } from "react";
import SendButton from "./SendButton";

type Props = {
  value: string;
  onChange(next: string): void;
  onSend(): void;
  sendDisabled: boolean;
};

export default function Composer(props: Props) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!props.sendDisabled) props.onSend();
    },
    [props],
  );

  return (
    <div className="fixed bottom-6 left-1/2 flex w-full max-w-xl items-center rounded-2xl border border-(--control-border) bg-(--control-bg) px-2 py-1 -translate-x-1/2">
      <input
        className="flex-1 bg-transparent px-3 py-2 text-sm text-(--control-fg) placeholder:text-(--control-placeholder) focus:outline-none"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type a message…"
      />
      <SendButton onClick={props.onSend} />
    </div>
  );
}
