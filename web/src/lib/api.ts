import { getAccessToken } from './auth'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  const accessToken = getAccessToken()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  const resolvedInput =
    typeof input === 'string' && input.startsWith('/') && baseUrl
      ? `${baseUrl}${input}`
      : input

  return fetch(resolvedInput, {
    ...init,
    headers,
  })
}
