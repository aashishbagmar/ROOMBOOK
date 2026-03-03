/*
 * In the browser, requests go to the same origin (e.g. localhost:3000/api/…)
 * and Next.js rewrites proxy them to the backend — no CORS needed.
 * On the server side (SSR), we call the backend directly.
 */
const API_BASE =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "";

/* ------------------------------------------------------------------ */
/*  Lightweight fetch wrapper (drop-in replacement for axios)         */
/*  Exposes api.get / post / patch / put / delete that all return     */
/*  { data, status, headers } – matching the shape consumers expect.  */
/* ------------------------------------------------------------------ */

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

interface ApiError {
  response?: { data?: any; status?: number };
  message: string;
}

function buildQueryString(params?: Record<string, any>): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) qs.append(key, String(value));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

async function request<T = any>(
  method: string,
  url: string,
  opts?: { body?: any; params?: Record<string, any> },
): Promise<ApiResponse<T>> {
  const fullUrl = `${API_BASE}${url}${buildQueryString(opts?.params)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("roombook_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method,
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (networkErr) {
    // Network failure (server down, DNS error, etc.)
    throw {
      message: "Network error — is the server running?",
      response: undefined,
    } as ApiError;
  }

  let data: any;
  if (res.status === 204) {
    // 204 No Content — no body to parse
    data = null;
  } else {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  }

  if (!res.ok) {
    // Handle 401 globally — but NOT for login/register endpoints
    const isAuthRoute = url.includes("/auth/");
    if (res.status === 401 && !isAuthRoute && typeof window !== "undefined") {
      localStorage.removeItem("roombook_token");
      window.location.href = "/login";
    }
    const err: ApiError = {
      message: typeof data?.detail === "string" ? data.detail : res.statusText,
      response: { data, status: res.status },
    };
    throw err;
  }

  return { data: data as T, status: res.status, headers: res.headers };
}

export const api = {
  get: <T = any>(url: string, opts?: { params?: Record<string, any> }) =>
    request<T>("GET", url, opts),

  post: <T = any>(url: string, body?: any) =>
    request<T>("POST", url, { body }),

  patch: <T = any>(url: string, body?: any) =>
    request<T>("PATCH", url, { body }),

  put: <T = any>(url: string, body?: any) =>
    request<T>("PUT", url, { body }),

  delete: <T = any>(url: string) =>
    request<T>("DELETE", url),
};
