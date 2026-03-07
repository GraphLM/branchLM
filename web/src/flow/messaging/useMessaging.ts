import { useCallback } from "react";
import { applyAutoLayout } from "../graph/graphModel";
import type { AppNode } from "../types";
import { makeChatNode, makeMessageNode } from "./messagingModel";
import {
  createChat,
  createMessage,
  updateChatTitle as updateChatTitleApi,
} from "./messagingApi";

export function useMessaging(params: {
  workspaceId: string;
  nodes: AppNode[];
  composerDraft: string;
  setComposerDraft: (value: string) => void;
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}) {
  const updateChatDraft = useCallback(
    (chatId: string, draft: string) => {
      params.setNodes((ns) =>
        ns.map((n) =>
          n.id === chatId && n.type === "chat" ? { ...n, data: { ...n.data, draft } } : n,
        ),
      );
    },
    [params],
  );

  const updateChatTitle = useCallback(
    (chatId: string, title: string) => {
      if (!params.workspaceId) return;
      params.setNodes((ns) =>
        ns.map((n) =>
          n.id === chatId && n.type === "chat" ? { ...n, data: { ...n.data, title } } : n,
        ),
      );

      updateChatTitleApi({ workspaceId: params.workspaceId, chatId, title }).catch(() => {});
    },
    [params],
  );

  const sendChatMessage = useCallback(
    async (chatId: string) => {
      if (!params.workspaceId) return;
      const chat = params.nodes.find((n) => n.id === chatId && n.type === "chat");
      if (!chat || chat.type !== "chat") return;

      const text = chat.data.draft.trim();
      if (!text) return;

      params.setNodes((ns) =>
        applyAutoLayout(
          ns.map((n) =>
            n.id === chatId && n.type === "chat" ? { ...n, data: { ...n.data, draft: "" } } : n,
          ),
        ),
      );

      const userCreated = await createMessage({
        workspaceId: params.workspaceId,
        chatId,
        role: "user",
        text,
      });
      if (!userCreated) return;

      const appText = `Mock response: Got it — "${text}"`;
      const appCreated = await createMessage({
        workspaceId: params.workspaceId,
        chatId,
        role: "app",
        text: appText,
      });
      if (!appCreated) return;

      const userMessage = makeMessageNode({
        id: userCreated.id,
        chatId,
        indexInChat: userCreated.ordinal,
        role: "user",
        text,
      });
      const appMessage = makeMessageNode({
        id: appCreated.id,
        chatId,
        indexInChat: appCreated.ordinal,
        role: "app",
        text: appText,
      });

      params.setNodes((ns) => applyAutoLayout(ns.concat(userMessage, appMessage)));
    },
    [params],
  );

  const sendComposerMessage = useCallback(async () => {
    if (!params.workspaceId) return;
    const text = params.composerDraft.trim();
    if (!text) return;

    const position = params.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const createdChat = await createChat({
      workspaceId: params.workspaceId,
      title: "New chat",
      position,
    });
    if (!createdChat) return;

    const chat = makeChatNode({
      id: createdChat.id,
      position,
      title: createdChat.title,
    });

    const userCreated = await createMessage({
      workspaceId: params.workspaceId,
      chatId: createdChat.id,
      role: "user",
      text,
    });
    if (!userCreated) return;

    const appText = `Mock response: Got it — "${text}"`;
    const appCreated = await createMessage({
      workspaceId: params.workspaceId,
      chatId: createdChat.id,
      role: "app",
      text: appText,
    });
    if (!appCreated) return;

    const userMessage = makeMessageNode({
      id: userCreated.id,
      chatId: createdChat.id,
      indexInChat: userCreated.ordinal,
      role: "user",
      text,
    });
    const appMessage = makeMessageNode({
      id: appCreated.id,
      chatId: createdChat.id,
      indexInChat: appCreated.ordinal,
      role: "app",
      text: appText,
    });

    params.setNodes((ns) => applyAutoLayout(ns.concat(chat, userMessage, appMessage)));
    params.setComposerDraft("");
  }, [params]);

  return {
    updateChatDraft,
    updateChatTitle,
    sendChatMessage,
    sendComposerMessage,
  };
}
