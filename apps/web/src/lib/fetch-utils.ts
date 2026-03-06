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
  signal?: AbortSignal,
): Promise<T> {
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) {
      url = `${endpoint}?${qs}`;
    }
  }
  const response = await fetch(url, { credentials: "include", signal });
  await throwIfNotOk(response);
  return (await response.json()) as T;
}

/** POST with FormData body (multipart). Always sends session cookie. */
export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
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
  const response = await fetch(endpoint, init);
  await throwIfNotOk(response);
  return (await response.json()) as T;
}
