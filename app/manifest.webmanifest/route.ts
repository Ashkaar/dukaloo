import { NextResponse } from "next/server";
import { currentShop, shopBase } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// The installable app's manifest, per shop: it carries the shop's name and
// opens at the shop's own till.
export async function GET() {
  const base = await shopBase();
  let name = "Dukaloo";
  let colour = "#0f6b63";
  try {
    const shop = await currentShop();
    if (shop) {
      name = shop.branch ? `${shop.name} · ${shop.branch}` : shop.name;
      if (/^#[0-9a-f]{6}$/i.test(shop.colour)) colour = shop.colour;
    }
  } catch {
    // No such shop: a plain Dukaloo manifest.
  }
  return NextResponse.json(
    {
      name,
      short_name: name.slice(0, 24),
      id: `${base}/`,
      start_url: `${base}/dashboard/till`,
      scope: `${base}/`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: colour,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } },
  );
}
