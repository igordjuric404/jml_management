/**
 * Frappe HTTP client — handles authentication, CSRF, and request formatting.
 *
 * All Frappe REST calls flow through this client so auth headers and base URL
 * are managed in one place.
 */

const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || "http://localhost:8000";

interface FrappeCallOptions {
  method?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

interface FrappeResponse<T = unknown> {
  message: T;
  exc_type?: string;
  exc?: string;
  _server_messages?: string;
}

let cachedCookies: string | null = null;

export function setFrappeCookies(cookies: string) {
  cachedCookies = cookies;
}

export function getFrappeUrl(): string {
  return FRAPPE_URL;
}

export async function frappeCall<T = unknown>(
  methodPath: string,
  options: FrappeCallOptions = {}
): Promise<T> {
  const { method = "POST", body, params } = options;

  let url = `${FRAPPE_URL}/api/method/${methodPath}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;
  if (apiKey && apiSecret) {
    headers["Authorization"] = `token ${apiKey}:${apiSecret}`;
  } else if (cachedCookies) {
    headers["Cookie"] = cachedCookies;
  }

  const fetchOptions: RequestInit = { method, headers };
  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Frappe API error (${res.status}): ${text}`);
  }

  const data: FrappeResponse<T> = await res.json();

  if (data.exc_type) {
    throw new Error(data.exc || data.exc_type);
  }

  return data.message;
}

export async function frappeGetDoc<T = unknown>(
  doctype: string,
  name: string,
  fields?: string[]
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;
  if (apiKey && apiSecret) {
    headers["Authorization"] = `token ${apiKey}:${apiSecret}`;
  } else if (cachedCookies) {
    headers["Cookie"] = cachedCookies;
  }

  let url = `${FRAPPE_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
  if (fields) {
    url += `?fields=${JSON.stringify(fields)}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Frappe resource error (${res.status})`);
  }

  const data = await res.json();
  return data.data;
}

export async function frappeGetList<T = unknown>(
  doctype: string,
  options: {
    filters?: Record<string, unknown> | unknown[];
    fields?: string[];
    order_by?: string;
    limit_page_length?: number;
    limit_start?: number;
  } = {}
): Promise<T[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;
  if (apiKey && apiSecret) {
    headers["Authorization"] = `token ${apiKey}:${apiSecret}`;
  } else if (cachedCookies) {
    headers["Cookie"] = cachedCookies;
  }

  const params = new URLSearchParams();
  if (options.filters) params.set("filters", JSON.stringify(options.filters));
  if (options.fields) params.set("fields", JSON.stringify(options.fields));
  if (options.order_by) params.set("order_by", options.order_by);
  if (options.limit_page_length !== undefined) {
    params.set("limit_page_length", String(options.limit_page_length));
  }
  if (options.limit_start !== undefined) {
    params.set("limit_start", String(options.limit_start));
  }

  const url = `${FRAPPE_URL}/api/resource/${encodeURIComponent(doctype)}?${params.toString()}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Frappe list error (${res.status})`);
  }

  const data = await res.json();
  return data.data;
}

export async function frappeLogin(
  username: string,
  password: string
): Promise<{ cookies: string; user: string; full_name: string }> {
  const res = await fetch(`${FRAPPE_URL}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usr: username, pwd: password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  const cookies = res.headers.get("set-cookie") || "";
  const data = await res.json();

  return {
    cookies,
    user: data.message || username,
    full_name: data.full_name || username,
  };
}
