import { withBase } from "./shopBase";

// Fetch helpers for client components. They add the shop's address to the
// URL and turn an error response into an ApiError with the server's
// (already translated) message.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function handle<T>(response: Response): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "";
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export async function getJson<T>(url: string): Promise<T> {
  return handle<T>(await fetch(withBase(url), { cache: "no-store", credentials: "same-origin" }));
}

export async function sendJson<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  return handle<T>(
    await fetch(withBase(url), {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

// Sends a file (e.g. a photo) as the request body.
export async function sendFile<T>(url: string, file: Blob): Promise<T> {
  return handle<T>(await fetch(withBase(url), { method: "PUT", credentials: "same-origin", headers: { "Content-Type": file.type }, body: file }));
}

// The message to show for a failed request: the server's, or a fallback.
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}
