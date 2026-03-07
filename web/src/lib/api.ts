import { getValidSession } from "./auth";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const baseHeaders = new Headers(init?.headers);
  const session = await getValidSession();
  if (session?.accessToken) {
    baseHeaders.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers: baseHeaders,
  });

  if (response.status !== 401) return response;

  // Token may have just expired or been rotated; force one refresh + retry.
  const refreshed = await getValidSession({ forceRefresh: true });
  if (!refreshed?.accessToken) return response;

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
  return fetch(input, {
    ...init,
    headers: retryHeaders,
  });
}
