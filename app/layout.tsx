import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Vazirmatn } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { ShopNotice } from "@/components/shop-notice";
import { ShopProvider, type ShopInfo } from "@/components/shop-provider";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";
import { LANGUAGES, MESSAGES } from "@/lib/i18n";
import { getLang, getOverrides } from "@/lib/i18n/server";
import { requestTimeZone } from "@/lib/settingsDb";
import { DEFAULT_TIME_ZONE } from "@/lib/format";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { accountUrl, currentShop, multiShop, profileOf, shopBase, ShopError, type Shop } from "@/lib/tenant";
import "./globals.css";

// Plus Jakarta Sans for Latin text (English, Turkish), Vazirmatn for Arabic
// script (Kurdish Sorani and Arabic, including ڕ ڵ ێ ۆ).
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta", display: "swap" });
const vazirmatn = Vazirmatn({ subsets: ["arabic"], variable: "--font-vazirmatn", display: "swap" });

const DEFAULT_THEME_COLOUR = "#0f6b63";

export async function generateMetadata(): Promise<Metadata> {
  let title = "Dukaloo";
  try {
    const shop = await currentShop();
    if (shop) title = shop.branch ? `${shop.name} · ${shop.branch}` : shop.name;
  } catch {
    // No such shop: the page says so.
  }
  return {
    title,
    description: "Dukaloo: point of sale and shop management",
    // Installable on a till, tablet or phone, and usable offline (public/sw.js).
    manifest: `${await shopBase()}/manifest.webmanifest`,
    appleWebApp: { capable: true, title, statusBarStyle: "default" },
    icons: { apple: "/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: DEFAULT_THEME_COLOUR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// A shop's own colour replaces Dukaloo's teal: the whole brand scale is
// mixed from it, lighter towards 50 and darker towards 950.
function brandScale(colour: string): React.CSSProperties {
  const mix = (percent: number, into: string) => `color-mix(in oklab, ${colour} ${percent}%, ${into})`;
  return {
    "--color-brand-50": mix(7, "white"),
    "--color-brand-100": mix(14, "white"),
    "--color-brand-200": mix(28, "white"),
    "--color-brand-300": mix(46, "white"),
    "--color-brand-400": mix(66, "white"),
    "--color-brand-500": mix(84, "white"),
    "--color-brand-600": mix(94, "white"),
    "--color-brand-700": colour,
    "--color-brand-800": mix(84, "black"),
    "--color-brand-900": mix(68, "black"),
    "--color-brand-950": mix(45, "black"),
  } as React.CSSProperties;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const base = await shopBase();
  const t = MESSAGES[lang].notice;

  let shop: Shop | null = null;
  let problem: "unknown" | "no-database" | null = null;
  try {
    shop = await currentShop();
    if (shop && shop.open && !shop.dbUrl) problem = "no-database";
  } catch (error) {
    if (!(error instanceof ShopError)) throw error;
    problem = error.code;
  }
  const profile = profileOf(shop);
  const closed = shop !== null && !shop.open;
  const blocked = problem !== null || closed;
  const overrides = blocked ? {} : await getOverrides(lang);
  const zone = blocked ? { setting: "device", timeZone: DEFAULT_TIME_ZONE } : await requestTimeZone();
  const account = multiShop() ? accountUrl() : null;

  const info: ShopInfo = {
    base,
    name: profile.name,
    branch: profile.branch,
    logoUrl: profile.logoUrl,
    currency: profile.currency,
    decimals: profile.decimals,
    timeZone: zone.timeZone,
    timeZoneSetting: zone.setting,
    accountUrl: account,
  };

  let notice: React.ReactNode = null;
  if (problem === "unknown") {
    notice = <ShopNotice title={t.notFoundTitle} text={t.notFoundText} action={account ? { href: account, label: t.account } : undefined} />;
  } else if (problem === "no-database") {
    notice = <ShopNotice title={profile.name} text={t.noDatabaseText} logoUrl={profile.logoUrl} />;
  } else if (closed) {
    const waiting = shop!.state === "waiting";
    notice = (
      <ShopNotice
        title={profile.name}
        subtitle={waiting ? t.waitingTitle : t.closedTitle}
        text={waiting ? t.waitingText : t.closedText}
        logoUrl={profile.logoUrl}
        action={account ? { href: account, label: t.account } : undefined}
      />
    );
  }

  return (
    <html
      lang={LANGUAGES[lang].html}
      dir={LANGUAGES[lang].dir}
      className={`${jakarta.variable} ${vazirmatn.variable}`}
      style={profile.colour ? brandScale(profile.colour) : undefined}
      data-shop-base={base}
      data-shop-since={profile.createdAt || undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {notice ?? (
          <ShopProvider value={info}>
            <I18nProvider lang={lang} overrides={overrides}>
              {children}
              <TimeZoneSync />
              <Toaster dir={LANGUAGES[lang].dir} />
            </I18nProvider>
          </ShopProvider>
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
