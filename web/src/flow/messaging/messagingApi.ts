import { apiFetch } from "../../lib/api";

export async function createChat(params: {
  title: string;
  position: { x: number; y: number };
}): Promise<{ id: string; title: string } | null> {
  const res = await apiFetch("/api/chats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title, position: params.position }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; title: string };
}

export async function updateChatTitle(params: {
  chatId: string;
  title: string;
}): Promise<void> {
  await apiFetch(`/api/chats/${params.chatId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title }),
  });
}

export async function createMessage(params: {
  chatId: string;
  role: "user" | "app";
  text: string;
}): Promise<{ id: string; ordinal: number } | null> {
  const res = await apiFetch(`/api/chats/${params.chatId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: params.role, text: params.text }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; ordinal: number };
}
