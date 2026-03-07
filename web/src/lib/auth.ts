const AUTH_STORAGE_KEY = "branchLM.auth.session";

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  user: {
    id: string;
    email: string | null;
  };
};

type VerifyOtpResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string | null;
  };
  error_description?: string;
  msg?: string;
};

type JwtPayload = {
  sub?: string;
  email?: string | null;
  exp?: number;
};

function getSupabaseAuthConfig(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  return { supabaseUrl, supabaseAnonKey };
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function isDevAuthBypassEnabled(): boolean {
  return isTruthy(import.meta.env.VITE_AUTH_DEV_BYPASS);
}

async function authRequest(path: string, init: RequestInit): Promise<Response> {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseAuthConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", supabaseAnonKey);
  headers.set("content-type", "application/json");

  return fetch(`${supabaseUrl}/auth/v1/${path}`, { ...init, headers });
}

export async function requestEmailOtp(email: string): Promise<void> {
  const res = await authRequest("otp", {
    method: "POST",
    body: JSON.stringify({
      email,
      create_user: true,
    }),
  });

  if (!res.ok) {
    let detail = `Failed to send code (${res.status})`;
    try {
      const data = (await res.json()) as VerifyOtpResponse;
      detail = data.error_description || data.msg || detail;
    } catch {
      // fall back to generic detail
    }
    throw new Error(detail);
  }
}

export async function verifyEmailOtp(params: {
  email: string;
  code: string;
}): Promise<AuthSession> {
  const res = await authRequest("verify", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      token: params.code,
      type: "email",
    }),
  });

  const data = (await res.json()) as VerifyOtpResponse;
  if (!res.ok) {
    const detail = data.error_description || data.msg || "Invalid or expired code";
    throw new Error(detail);
  }

  if (!data.access_token || !data.user?.id) {
    throw new Error("Auth session missing access token");
  }

  const session: AuthSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  };
  persistSession(session);
  return session;
}

export function createDevBypassSession(email: string): AuthSession {
  const normalizedEmail = email.trim().toLowerCase();
  const encodedEmail = toBase64Url(normalizedEmail);
  const session: AuthSession = {
    accessToken: `dev-bypass:${encodedEmail}`,
    refreshToken: null,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    user: {
      id: `dev:${normalizedEmail}`,
      email: normalizedEmail,
    },
  };
  persistSession(session);
  return session;
}

export function persistSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.user?.id) return null;
    if (parsed.expiresAt && Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function parseJwtPayload(token: string): JwtPayload | null {
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const payload = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function consumeSessionFromUrlHash(): AuthSession | null {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#")) return null;

  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresInRaw = params.get("expires_in");
  const tokenType = params.get("token_type");
  if (!accessToken || tokenType !== "bearer") return null;

  const jwt = parseJwtPayload(accessToken);
  const expiresIn = expiresInRaw ? Number(expiresInRaw) : null;
  const expiresAt =
    Number.isFinite(expiresIn) && expiresIn != null ? Date.now() + expiresIn * 1000 : null;
  const session: AuthSession = {
    accessToken,
    refreshToken,
    expiresAt,
    user: {
      id: jwt?.sub ?? "",
      email: jwt?.email ?? null,
    },
  };
  if (!session.user.id) return null;

  persistSession(session);
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return session;
}
