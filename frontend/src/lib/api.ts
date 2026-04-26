/* Tiny fetch wrapper. Calls go to NEXT_PUBLIC_API_URL when set (production
   static export), or to relative /api/... when running with the dev server +
   Next rewrites. */
const RAW = process.env.NEXT_PUBLIC_API_URL ?? "";
const BASE = RAW.replace(/\/$/, "");
const PREFIX = BASE ? `${BASE}/api` : "/api";

export const API_BASE = BASE;

/** Resolve a possibly-relative URL returned by the backend (e.g. `/uploads/avatars/...`)
 *  into a fully qualified URL by prepending the API host when needed. */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (BASE && url.startsWith("/")) return `${BASE}${url}`;
  return url;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("nw_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, headers, ...rest } = init;
  const res = await fetch(`${PREFIX}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(skipAuth ? {} : authHeaders()),
      ...(headers || {}),
    },
    cache: "no-store",
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : null) || res.statusText;
    throw new ApiError(res.status, detail, data);
  }
  return data as T;
}

/** Send a multipart/form-data POST. Used for avatar/banner uploads. */
export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
  init: { method?: string } = {},
): Promise<T> {
  const res = await fetch(`${PREFIX}${path}`, {
    method: init.method ?? "POST",
    body: form,
    headers: { ...authHeaders() },
    cache: "no-store",
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : null) || res.statusText;
    throw new ApiError(res.status, detail, data);
  }
  return data as T;
}

export const fetcher = <T = unknown>(path: string) => apiFetch<T>(path);
