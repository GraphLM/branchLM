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
