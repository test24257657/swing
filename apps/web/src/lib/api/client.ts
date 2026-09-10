import { clearSession, getToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`API ${status}: ${detail}`);
    this.name = "ApiError";
  }
}

/**
 * Thin fetch wrapper. Every endpoint returns `{ data, meta }`; callers get the whole
 * envelope so panels can render provenance and the stale flag. Attaches the bearer
 * token; a 401 clears the session and bounces to /login.
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<T> {
  const url = new URL(
    `${BASE}${path}`,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const token = getToken();
  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired — please sign in again");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Authenticated fetch for non-GET calls (saved screens, watchlist, etc.). */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function mutate<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((res) => handleResponse<T>(res));
}

export const apiPost = <T>(path: string, body?: unknown) => mutate<T>("POST", path, body);
export const apiPatch = <T>(path: string, body?: unknown) => mutate<T>("PATCH", path, body);
export const apiDelete = <T>(path: string) => mutate<T>("DELETE", path);
