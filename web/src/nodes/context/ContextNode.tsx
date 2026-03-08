import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useRef, useState } from "react";
import type { ContextNode } from "../../flow/types";
import { useFlowActions } from "../../flow/actionsContext";
import NodeDeleteButton from "../../ui/NodeDeleteButton";

export default function ContextNodeComponent(props: NodeProps<ContextNode>) {
  const { id, data, selected } = props;
  const actions = useFlowActions();
  const [busy, setBusy] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasSource = data.assetCount > 0;

  return (
    <div
      className={[
        "group relative h-full w-full rounded-md border bg-(--chat-bg) text-(--msg-fg) elev-2 p-3",
        selected
          ? "border-(--selection-border) ring-2 ring-(--selection-ring)"
          : "border-(--chat-border)",
      ].join(" ")}
    >
      <div className="context-drag-handle flex items-center justify-between cursor-grab">
        <p className="text-sm font-semibold truncate">{data.title}</p>
        <NodeDeleteButton title="Delete context node" onClick={() => actions.deleteContextNode(id)} />
      </div>

      <p className="mt-2 text-xs text-(--panel-muted)">
        Source: {hasSource ? "configured" : "not configured"}
      </p>
      <p className="text-xs text-(--panel-muted)">
        {data.statusText ?? "Import one file or paste one text block for this node."}
      </p>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          actions
            .uploadContextAsset(id, file)
            .finally(() => {
              setBusy(false);
              if (inputRef.current) inputRef.current.value = "";
            });
        }}
      />

      <button
        type="button"
        className="mt-3 rounded-md border border-(--control-border) bg-(--control-bg) px-2 py-1 text-xs hover:cursor-pointer"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "Uploading..." : hasSource ? "Replace file" : "Import file"}
      </button>

      <button
        type="button"
        className="mt-2 ml-2 rounded-md border border-(--control-border) bg-(--control-bg) px-2 py-1 text-xs hover:cursor-pointer"
        onClick={() => setTextMode((prev) => !prev)}
        disabled={busy}
      >
        {hasSource ? "Replace text" : "Paste text"}
      </button>

      {textMode ? (
        <div className="mt-2">
          <textarea
            className="w-full rounded-md border border-(--chat-border) bg-(--canvas-bg) p-2 text-xs"
            rows={4}
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder="Paste text context here..."
          />
          <button
            type="button"
            className="mt-2 rounded-md border border-(--control-border) bg-(--control-bg) px-2 py-1 text-xs hover:cursor-pointer"
            disabled={busy || !textDraft.trim()}
            onClick={() => {
              setBusy(true);
              actions
                .uploadContextText(id, textDraft)
                .then(() => {
                  setTextDraft("");
                  setTextMode(false);
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving..." : "Save pasted text"}
          </button>
        </div>
      ) : null}

      <Handle
        type="source"
        position={Position.Right}
        className="rf-handle-connect rf-handle-connect--source bg-(--handle-bg)! border-(--handle-border)! cursor-pointer"
        title="Connect this context node to a chat"
      />
    </div>
  );
}
