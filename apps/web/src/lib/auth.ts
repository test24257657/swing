"use client";

/** Token storage + auth helpers. Single-user JWT bearer auth. */

const KEY = "swing.token";
const EMAIL_KEY = "swing.email";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setSession(token: string, email: string): void {
  try {
    window.localStorage.setItem(KEY, token);
    window.localStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* private mode — session lives only for this page */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export async function login(email: string, password: string): Promise<{ email: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? "Incorrect email or password");
  }
  const data = (await res.json()) as { access_token: string; email: string };
  setSession(data.access_token, data.email);
  return { email: data.email };
}

export function logout(): void {
  clearSession();
  if (typeof window !== "undefined") window.location.href = "/login";
}
