import "server-only";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { getViewer } from "./access";
import { getMessages } from "./i18n/server";
import type { Section, Viewer } from "./sections";

// Helpers shared by the API routes. Every route checks for itself who may
// call it (one of the guards below) and validates every field it reads.

type Guarded = { viewer: Viewer; error: null } | { viewer: null; error: NextResponse };

async function fail(status: number, key: "notLoggedIn" | "noAccess" | "ownerOnly"): Promise<Guarded> {
  return { viewer: null, error: NextResponse.json({ error: (await getMessages()).errors[key] }, { status }) };
}

// Signed in, of any kind.
export async function requireLogin(): Promise<Guarded> {
  const viewer = await getViewer();
  return viewer ? { viewer, error: null } : fail(401, "notLoggedIn");
}

// Signed in and allowed to open at least one of `sections` (which also
// means the shop's plan includes it).
export async function requireSection(...sections: Section[]): Promise<Guarded> {
  const viewer = await getViewer();
  if (!viewer) return fail(401, "notLoggedIn");
  return sections.some((s) => viewer.sections.includes(s)) ? { viewer, error: null } : fail(403, "noAccess");
}

// The owner, or the owner password entered on this device.
export async function requireOwner(): Promise<Guarded> {
  const viewer = await getViewer();
  if (!viewer) return fail(401, "notLoggedIn");
  return viewer.isOwner ? { viewer, error: null } : fail(403, "ownerOnly");
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Parses the request body with a Zod schema; an error response when it doesn't fit.
export async function parseBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: NextResponse }> {
  const result = schema.safeParse(await readJson(request));
  if (result.success) return { data: result.data, error: null };
  return { data: null, error: await badRequest() };
}

export async function badRequest(message?: string): Promise<NextResponse> {
  return NextResponse.json({ error: message ?? (await getMessages()).errors.invalid }, { status: 400 });
}

export async function notFound(): Promise<NextResponse> {
  return NextResponse.json({ error: (await getMessages()).errors.notFound }, { status: 404 });
}

// `action` is for the server log only; the visitor gets a translated text.
export async function serverError(action: string, error: unknown): Promise<NextResponse> {
  console.error(`Failed to ${action}:`, error);
  return NextResponse.json({ error: (await getMessages()).errors.server }, { status: 500 });
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id <= Number.MAX_SAFE_INTEGER ? id : null;
}
