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
 * envelope so panels can render provenance and the stale flag.
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<T> {
  const url = new URL(`${BASE}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
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
  return res.json() as Promise<T>;
}
