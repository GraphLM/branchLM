import { getStoredSession } from "./auth";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = getStoredSession();
  const headers = new Headers(init?.headers);

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
