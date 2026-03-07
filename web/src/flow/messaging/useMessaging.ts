import { useCallback } from "react";
import { applyAutoLayout } from "../graph/graphModel";
import type { AppNode, MessageNode as MessageFlowNode } from "../types";
import { makeChatNode, makeMessageNode } from "./messagingModel";
import {
  createChat,
  generateReply,
  updateChatTitle as updateChatTitleApi,
} from "./messagingApi";

export function useMessaging(params: {
  workspaceId: string;
  nodes: AppNode[];
  setNodes: React.Dispatch<React.SetStateAction<AppNode[]>>;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}) {
  const updateChatDraft = useCallback(
    (chatId: string, draft: string) => {
      params.setNodes((ns) =>
        applyAutoLayout(
          ns.map((n) =>
            n.id === chatId && n.type === "chat" ? { ...n, data: { ...n.data, draft } } : n,
          ),
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

      const nextOrdinal =
        params.nodes
          .filter(
            (n): n is MessageFlowNode => n.type === "message" && n.parentId === chatId,
          )
          .reduce((max, n) => Math.max(max, n.data.ordinal), -1) + 1;

      const tempUserId = `temp-user-${chatId}-${Date.now()}`;
      const tempAppId = `temp-app-${chatId}-${Date.now()}`;
      const optimisticUser = makeMessageNode({
        id: tempUserId,
        chatId,
        indexInChat: nextOrdinal,
        role: "user",
        text,
      });
      const optimisticApp = makeMessageNode({
        id: tempAppId,
        chatId,
        indexInChat: nextOrdinal + 1,
        role: "app",
        text: "",
        loading: true,
      });

      params.setNodes((ns) =>
        applyAutoLayout(
          ns
            .map((n) =>
              n.id === chatId && n.type === "chat" ? { ...n, data: { ...n.data, draft: "" } } : n,
            )
            .concat(optimisticUser, optimisticApp),
        ),
      );

      const generated = await generateReply({ workspaceId: params.workspaceId, chatId, text });
      if (!generated) {
        params.setNodes((ns) =>
          applyAutoLayout(
            ns
              .filter((n) => n.id !== tempUserId && n.id !== tempAppId)
              .map((n) =>
                n.id === chatId && n.type === "chat"
                  ? { ...n, data: { ...n.data, draft: n.data.draft.length ? n.data.draft : text } }
                  : n,
              ),
          ),
        );
        return;
      }
      params.setNodes((ns) =>
        applyAutoLayout(
          ns.map((n) =>
            n.id === tempUserId && n.type === "message"
              ? {
                  ...n,
                  id: generated.userMessage.id,
                  data: {
                    ...n.data,
                    ordinal: generated.userMessage.ordinal,
                    text: generated.userMessage.text,
                  },
                }
              : n,
          ),
        ),
      );

      const fullReply = generated.appMessage.text;
      let streamedReply = "";
      for (let i = 0; i < fullReply.length; ) {
        const chunkSize = Math.min(fullReply.length - i, Math.floor(Math.random() * 3) + 1);
        streamedReply += fullReply.slice(i, i + chunkSize);
        i += chunkSize;

        params.setNodes((ns) =>
          applyAutoLayout(
            ns.map((n) =>
              n.id === tempAppId && n.type === "message"
                ? { ...n, data: { ...n.data, text: streamedReply, loading: i < fullReply.length } }
                : n,
            ),
          ),
        );

        await new Promise((resolve) => window.setTimeout(resolve, 22));
      }

      const appMessage = makeMessageNode({
        id: generated.appMessage.id,
        chatId,
        indexInChat: generated.appMessage.ordinal,
        role: "app",
        text: generated.appMessage.text,
      });
      params.setNodes((ns) =>
        applyAutoLayout(ns.filter((n) => n.id !== tempAppId).concat(appMessage)),
      );
    },
    [params],
  );

  const focusChatDraft = useCallback(
    (chatId: string) => {
      params.setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== chatId || n.type !== "chat") return n;
          return {
            ...n,
            data: { ...n.data, focusToken: (n.data.focusToken ?? 0) + 1 },
          };
        }),
      );
    },
    [params],
  );

  const createChatDraft = useCallback(async () => {
    if (!params.workspaceId) return;

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
    const createdChatNode = {
      ...chat,
      selected: true,
      data: { ...chat.data, focusToken: 1 },
    };

    params.setNodes((ns) =>
      applyAutoLayout(ns.map((n) => ({ ...n, selected: false })).concat(createdChatNode)),
    );
  }, [params]);

  return {
    updateChatDraft,
    updateChatTitle,
    sendChatMessage,
    focusChatDraft,
    createChatDraft,
  };
}
