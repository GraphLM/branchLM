/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from "react";

export type FlowActions = {
  deleteChat(chatId: string): void;
  updateChatTitle(chatId: string, title: string): void;
  updateChatDraft(chatId: string, draft: string): void;
  sendChatMessage(chatId: string): void;
  deleteMessage(messageId: string): void;
};

const FlowActionsContext = createContext<FlowActions | null>(null);

export function FlowActionsProvider(props: {
  value: FlowActions;
  children: ReactNode;
}) {
  return (
    <FlowActionsContext.Provider value={props.value}>
      {props.children}
    </FlowActionsContext.Provider>
  );
}

export function useFlowActions(): FlowActions {
  const ctx = useContext(FlowActionsContext);
  if (!ctx) {
    throw new Error("useFlowActions must be used within a FlowActionsProvider");
  }
  return ctx;
}
