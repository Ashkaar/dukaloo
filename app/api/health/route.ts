import { getShopDb } from "@/lib/db";
import { ok, requireLogin } from "@/lib/api";

// GET → { ok, db } after a SELECT 1 on the shop's database (signed in only).
export async function GET() {
  const { error } = await requireLogin();
  if (error) return error;
  try {
    const { client } = await getShopDb();
    await client.execute("SELECT 1");
    return ok({ ok: true, db: "ok" });
  } catch (err) {
    console.error("Health check failed:", err);
    return ok({ ok: false, db: "unreachable" }, 503);
  }
}
