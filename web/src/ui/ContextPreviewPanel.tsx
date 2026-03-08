import { X } from "lucide-react";
import type { ContextPreviewDTO } from "../flow/messaging/messagingApi";

type Props = {
  open: boolean;
  title: string;
  loading: boolean;
  error: string | null;
  data: ContextPreviewDTO | null;
  onClose: () => void;
};

function reasonLabel(reason: "included" | "dropped_token_budget" | "dropped_message_limit"): string {
  if (reason === "dropped_message_limit") return "Message limit";
  if (reason === "dropped_token_budget") return "Token budget";
  return "Included";
}

function sourceLabel(source: "chat_history" | "branch_context"): string {
  return source === "branch_context" ? "Branch context" : "Chat history";
}

export default function ContextPreviewPanel(props: Props) {
  if (!props.open) return null;

  return (
    <aside className="fixed right-4 top-4 bottom-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-(--panel-border) bg-(--panel-bg) text-(--panel-fg) elev-3 backdrop-blur">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-(--panel-border) px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Context Preview</div>
            <div className="text-xs text-(--panel-muted) truncate">{props.title || "Chat"}</div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-transparent p-1 hover:cursor-pointer hover:border-(--control-border-hover) hover:bg-(--control-bg-hover)"
            onClick={props.onClose}
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 text-sm">
          {props.loading ? <div className="text-(--panel-muted)">Loading preview...</div> : null}
          {!props.loading && props.error ? <div className="text-red-300">{props.error}</div> : null}
          {!props.loading && !props.error && !props.data ? (
            <div className="text-(--panel-muted)">No preview data.</div>
          ) : null}

          {!props.loading && !props.error && props.data ? (
            <>
              <div className="rounded-xl border border-(--panel-border) bg-(--control-bg) px-3 py-2 text-xs text-(--panel-muted)">
                <div>Model: {props.data.model}</div>
                <div>Prompt tokens: {props.data.promptTokens}</div>
                <div>Input budget: {props.data.inputBudgetTokens}</div>
                <div>Included: {props.data.counts.included} ({props.data.tokens.included} tokens)</div>
                <div>Excluded: {props.data.counts.excluded} ({props.data.tokens.excluded} tokens)</div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-(--panel-muted)">Context nodes</h3>
                <div className="mt-2 rounded-xl border border-(--panel-border) bg-(--control-bg) px-3 py-2 text-xs">
                  <div className="text-(--panel-muted)">
                    Linked nodes: {props.data.externalContext.linkedNodes} · Used nodes: {props.data.externalContext.usedNodes}
                  </div>
                  {props.data.externalContext.included && props.data.externalContext.text ? (
                    <p className="mt-1 whitespace-pre-wrap break-words leading-snug">{props.data.externalContext.text}</p>
                  ) : null}
                  {!props.data.externalContext.included && props.data.externalContext.blockedReason ? (
                    <p className="mt-1 whitespace-pre-wrap break-words leading-snug text-amber-200">
                      {props.data.externalContext.blockedReason}
                    </p>
                  ) : null}
                  {!props.data.externalContext.included &&
                  !props.data.externalContext.blockedReason &&
                  props.data.externalContext.linkedNodes === 0 ? (
                    <p className="mt-1 text-(--panel-muted)">No context nodes linked to this chat.</p>
                  ) : null}
                </div>
                {props.data.externalContext.pendingNodes.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-(--panel-border) px-3 py-2 text-xs text-(--panel-muted)">
                    Pending: {props.data.externalContext.pendingNodes.join(", ")}
                  </div>
                ) : null}
                {props.data.externalContext.statusErrorNodes.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-(--panel-border) px-3 py-2 text-xs text-red-300">
                    Access errors: {props.data.externalContext.statusErrorNodes.join(", ")}
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-(--panel-muted)">Included</h3>
                <ul className="mt-2 space-y-2">
                  {props.data.included.length === 0 ? (
                    <li className="text-xs text-(--panel-muted)">No included context messages.</li>
                  ) : (
                    props.data.included.map((message) => (
                      <li key={`in-${message.messageId}`} className="rounded-xl border border-(--panel-border) px-3 py-2">
                        <div className="text-[11px] text-(--panel-muted)">
                          {sourceLabel(message.source)} · {message.role} · #{message.ordinal} · {message.tokenEstimate} tok
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-snug">{message.text}</p>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-(--panel-muted)">Excluded</h3>
                <ul className="mt-2 space-y-2">
                  {props.data.excluded.length === 0 ? (
                    <li className="text-xs text-(--panel-muted)">No excluded context messages.</li>
                  ) : (
                    props.data.excluded.map((message) => (
                      <li key={`ex-${message.messageId}`} className="rounded-xl border border-(--panel-border) px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] text-(--panel-muted)">
                          <span>{sourceLabel(message.source)} · {message.role} · #{message.ordinal} · {message.tokenEstimate} tok</span>
                          <span className="rounded-full border border-(--control-border) px-2 py-0.5">{reasonLabel(message.reason)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-snug">{message.text}</p>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {props.data.summary.enabled ? (
                <div className="mt-4 rounded-xl border border-(--panel-border) bg-(--control-bg) px-3 py-2 text-xs">
                  <div className="font-medium">Truncation summary</div>
                  <div className="mt-1 text-(--panel-muted)">
                    {props.data.summary.included
                      ? props.data.summary.text
                      : "Summary was eligible but not included in the final prompt."}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
