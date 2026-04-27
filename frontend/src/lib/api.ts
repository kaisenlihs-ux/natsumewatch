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
    throw new ApiError(res.status, formatDetail(data, res.statusText), data);
  }
  return data as T;
}

const FIELD_LABELS: Record<string, string> = {
  username: "Имя пользователя",
  email: "Email",
  password: "Пароль",
  email_or_username: "Email/имя",
  body: "Текст",
  title: "Заголовок",
  score: "Оценка",
};

/** Convert a FastAPI error payload into a single human-readable string. */
function formatDetail(data: unknown, fallback: string): string {
  if (typeof data === "string" && data) return data;
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const parts = d
        .map((e) => {
          if (e && typeof e === "object" && "msg" in e) {
            const obj = e as { msg: unknown; loc?: unknown };
            const loc = Array.isArray(obj.loc) ? obj.loc : [];
            // FastAPI body errors look like ["body", "<field>"], so the
            // field name is the last array element.
            const last = loc[loc.length - 1];
            const field = typeof last === "string" ? last : null;
            const label = field ? FIELD_LABELS[field] ?? field : null;
            const msg = String(obj.msg);
            return label ? `${label}: ${msg}` : msg;
          }
          return typeof e === "string" ? e : "";
        })
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    if (d && typeof d === "object" && "msg" in d) {
      return String((d as { msg: unknown }).msg);
    }
  }
  return fallback;
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
    throw new ApiError(res.status, formatDetail(data, res.statusText), data);
  }
  return data as T;
}

export const fetcher = <T = unknown>(path: string) => apiFetch<T>(path);
