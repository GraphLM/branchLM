import { getValidSession } from "./auth";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

function resolveApiInput(input: RequestInfo | URL): RequestInfo | URL {
  if (!apiBaseUrl) return input;
  if (typeof input !== "string") return input;
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  if (input.startsWith("/")) return `${apiBaseUrl}${input}`;
  return `${apiBaseUrl}/${input}`;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const baseHeaders = new Headers(init?.headers);
  const session = await getValidSession();
  if (session?.accessToken) {
    baseHeaders.set("Authorization", `Bearer ${session.accessToken}`);
  }
  const resolvedInput = resolveApiInput(input);

  const response = await fetch(resolvedInput, {
    ...init,
    headers: baseHeaders,
  });

  if (response.status !== 401) return response;

  // Token may have just expired or been rotated; force one refresh + retry.
  const refreshed = await getValidSession({ forceRefresh: true });
  if (!refreshed?.accessToken) return response;

  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
  return fetch(resolvedInput, {
    ...init,
    headers: retryHeaders,
  });
}
