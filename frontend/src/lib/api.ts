/* Tiny fetch wrapper. We use Next rewrites: client always calls /api/... */
const PREFIX = "/api";

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

export const fetcher = <T = unknown>(path: string) => apiFetch<T>(path);
