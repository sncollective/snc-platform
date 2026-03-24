import { type APIRequestContext } from "@playwright/test";

/**
 * Log in via the Better Auth API endpoint and set session cookies
 * on the request context. Returns the raw response for assertions.
 */
export async function loginViaAPI(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `Login failed for ${email}: ${response.status()} ${body}`,
    );
  }
}
