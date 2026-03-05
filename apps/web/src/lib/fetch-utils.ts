import { API_BASE_URL } from "./config.js";

/**
 * Throws an Error if the response is not OK.
 * Extracts the error message from the response body if possible.
 */
export async function throwIfNotOk(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      (body as { error?: { message?: string } } | null)?.error?.message ??
      response.statusText;
    throw new Error(message);
  }
}

/** GET with optional query params. Always sends session cookie. */
export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString(), { credentials: "include" });
  await throwIfNotOk(response);
  return (await response.json()) as T;
}

/** POST/PATCH/DELETE with JSON body. Always sends session cookie. */
export async function apiMutate<T>(
  endpoint: string,
  options: { method?: string; body?: unknown },
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "POST",
    credentials: "include",
    headers: options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {},
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, init);
  await throwIfNotOk(response);
  return (await response.json()) as T;
}
