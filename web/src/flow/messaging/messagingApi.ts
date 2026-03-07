import { apiFetch } from "../../lib/api";

export async function createChat(params: {
  workspaceId: string;
  title: string;
  position: { x: number; y: number };
}): Promise<{ id: string; title: string } | null> {
  const res = await apiFetch(`/api/workspaces/${params.workspaceId}/chats`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title, position: params.position }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; title: string };
}

export async function updateChatTitle(params: {
  workspaceId: string;
  chatId: string;
  title: string;
}): Promise<void> {
  await apiFetch(`/api/workspaces/${params.workspaceId}/chats/${params.chatId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title }),
  });
}

export async function createMessage(params: {
  workspaceId: string;
  chatId: string;
  role: "user" | "app";
  text: string;
}): Promise<{ id: string; ordinal: number } | null> {
  const res = await apiFetch(`/api/workspaces/${params.workspaceId}/chats/${params.chatId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: params.role, text: params.text }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; ordinal: number };
}

export async function generateReply(params: {
  workspaceId: string;
  chatId: string;
  text: string;
}): Promise<
  | {
      userMessage: { id: string; chatId: string; ordinal: number; role: "user"; text: string };
      appMessage: { id: string; chatId: string; ordinal: number; role: "app"; text: string };
    }
  | null
> {
  const res = await apiFetch(
    `/api/workspaces/${params.workspaceId}/chats/${params.chatId}/generate`,
    {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: params.text }),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as {
    userMessage: { id: string; chatId: string; ordinal: number; role: "user"; text: string };
    appMessage: { id: string; chatId: string; ordinal: number; role: "app"; text: string };
  };
}
