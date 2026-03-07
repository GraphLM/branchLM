import { useCallback } from "react";
import { applyAutoLayout } from "../graph/graphModel";
import type { AppNode } from "../types";
import { makeChatNode, makeMessageNode } from "./messagingModel";
import {
  createChat,
  generateReply,
  updateChatTitle as updateChatTitleApi,
} from "./messagingApi";

export function useMessaging(params: {
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
      params.setNodes((ns) =>
        ns.map((n) =>
          n.id === chatId && n.type === "chat" ? { ...n, data: { ...n.data, title } } : n,
        ),
      );

      updateChatTitleApi({ chatId, title }).catch(() => {});
    },
    [params],
  );

  const sendChatMessage = useCallback(
    async (chatId: string) => {
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

      const generated = await generateReply({ chatId, text });
      if (!generated) return;

      const userMessage = makeMessageNode({
        id: generated.userMessage.id,
        chatId,
        indexInChat: generated.userMessage.ordinal,
        role: "user",
        text: generated.userMessage.text,
      });
      const appMessage = makeMessageNode({
        id: generated.appMessage.id,
        chatId,
        indexInChat: generated.appMessage.ordinal,
        role: "app",
        text: generated.appMessage.text,
      });

      params.setNodes((ns) => applyAutoLayout(ns.concat(userMessage, appMessage)));
    },
    [params],
  );

  const sendComposerMessage = useCallback(async () => {
    const text = params.composerDraft.trim();
    if (!text) return;

    const position = params.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const createdChat = await createChat({
      title: "New chat",
      position,
    });
    if (!createdChat) return;

    const chat = makeChatNode({
      id: createdChat.id,
      position,
      title: createdChat.title,
    });

    const generated = await generateReply({ chatId: createdChat.id, text });
    if (!generated) return;

    const userMessage = makeMessageNode({
      id: generated.userMessage.id,
      chatId: createdChat.id,
      indexInChat: generated.userMessage.ordinal,
      role: "user",
      text: generated.userMessage.text,
    });
    const appMessage = makeMessageNode({
      id: generated.appMessage.id,
      chatId: createdChat.id,
      indexInChat: generated.appMessage.ordinal,
      role: "app",
      text: generated.appMessage.text,
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
