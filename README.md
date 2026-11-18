# Dukaloo

Point of sale and shop management for retail shops: a till with barcode
scanning, products with variants, stock, purchases and suppliers, customers,
expenses, invoices, reports and backups. It runs in the browser on phones,
tablets, computers and touch tills, with nothing to install, and keeps
working offline.

Dukaloo is the second app sold through [Ariloo](https://ariloo.app), after
Restafe. One deployment serves every Dukaloo shop, each at its own address
(`https://dukaloo.ariloo.app/<shop>/…`) with its own database. It speaks
English, Kurdish (Sorani, right to left), Arabic (right to left) and
Turkish, in light and dark mode.

## What's in it so far

| Area | Status |
| --- | --- |
| Many shops, Ariloo sign-in, plans, closed-shop pages | Done |
| Owner password, staff logins with per-section access, owner unlock on shared tills | Done |
| Dashboard, Settings (theme, language, shop details from Ariloo) | Done |
| Products with variants (size, colour…), categories, barcodes, label printing | Done |
| Till: scanner and camera input, cart, payments, receipts, cash drawer, returns | Next |
| Stock movements, purchases, suppliers, counts, low-stock alerts | Planned |
| Customers, expenses, invoices | Planned |
| Offline: product catalogue on the device, outbox, background sync, installable app | Planned |
| Reports, backups | Planned |

## Stack

- Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript (strict)
- Tailwind CSS v4 with the colour tokens in `app/globals.css`;
  shadcn/ui-style components on Radix (`components/ui/`), lucide icons,
  sonner toasts
- Turso (libSQL) via `@libsql/client`, queried with Drizzle ORM; Zod for
  validation shared by browser and server
- Vercel, functions in Dublin (`dub1`, next to Turso `aws-eu-west-1`), with
  Vercel Analytics and Speed Insights
- Vitest for unit tests, Playwright for browser checks

## Getting started

```bash
cp .env.example .env.local   # single-shop mode works with the defaults
npm install
npm run dev                  # http://localhost:3000
```

In single-shop mode (no Ariloo variables) the app serves one shop at the
plain paths from `DB_TURSO_DATABASE_URL` (a local `file:local.db` works).
Sign in as Owner with `OWNER_PASSWORD`, or choose a new owner password at
`/owner-password` once signed in.

`npm run check` runs everything a pull request must pass: type check, lint,
unit tests and a production build.

## Environment variables

Set these in the Vercel project (Production). Never commit them.

| Name | Purpose |
| --- | --- |
| `ARILOO_DB_URL`, `ARILOO_DB_TOKEN` | Ariloo's database, with a **read-only** token. Setting both turns many-shop mode on. Dukaloo reads `ariloo_shops` rows with `product = 'dukaloo'` and never writes to it. |
| `SHOPS_DB_TOKEN` | A Turso group token that opens every shop's own database (`db_url` in Ariloo). |
| `DUKALOO_SSO_SECRET` | Shared with Ariloo; checks the one-minute "Open Dukaloo" link. Without it, owners can't arrive from Ariloo. |
| `ARILOO_URL` | Where Ariloo lives, for shop logos and account links. Default `https://ariloo.app`. |
| `DB_TURSO_DATABASE_URL`, `DB_TURSO_AUTH_TOKEN` | Single-shop mode only: the one shop's database. |
| `OWNER_PASSWORD` | Single-shop mode only: the owner password until one is chosen in the app. |
| `SHOP_NAME`, `SHOP_CURRENCY`, `SHOP_DECIMALS`, `SHOP_LANG` | Single-shop mode only: the shop's details, which Ariloo provides in many-shop mode. |

## Many shops

- **Addresses.** Each shop lives at `/<shop>/…`. `proxy.ts` strips the prefix
  and passes the shop on in the `x-dukaloo-shop` request header, which it
  always removes from incoming requests first; the pages and API routes are
  the same for every shop. In the browser, `useShop().href()` and the fetch
  helpers in `lib/clientApi.ts` add the shop's address, and `shopKey()`
  keeps each shop's saved data apart on a shared device. The bare domain
  redirects to Ariloo; an app path without a shop is a 404.
- **Shop details.** `lib/tenant.ts` reads the shop's row from Ariloo (cached
  for 30 seconds): name, branch, colour, currency, decimals, language, logo
  (`https://ariloo.app/api/shop-logo/<id>?v=<logo_version>`), plan and
  subscription dates. These are never copied into the shop's database, and
  currency is fixed after setup.
- **Shop state.** Worked out in `lib/shopState.ts`: suspended; paid until a
  future time → active; paid until less than 5 days ago → grace; else a
  running trial → trial; neither date set → waiting; otherwise expired. The
  shop opens only in trial, active and grace; otherwise every page shows a
  plain "not open yet" or "closed" notice with a link to the Ariloo account.
- **Plans.** A trial has everything. When active or in grace, the plan
  (starter / pro / advanced) decides the sections, in one place:
  `lib/plans.ts`. `getViewer()` (`lib/access.ts`) only returns sections in
  the plan, so the navigation, the pages and the API all follow it. For now
  every plan opens everything; the split will be decided on Ariloo.
- **Data.** Each shop has its own Turso database (`db_url`), opened with
  `SHOPS_DB_TOKEN`. Tables are created on first use (`lib/db/setup.ts`) and
  a new shop starts empty.
- **Owner sign-in.** Ariloo's "Open Dukaloo" button sends the owner to
  `/<shop>/api/auth/sso?token=v1.<shop>.<expires>.<hmac>`, where `hmac` is
  HMAC-SHA256 hex of `sso:<shop>.<expires>` with `DUKALOO_SSO_SECRET`. It is
  valid for one minute and only for that shop. On the first visit the owner
  chooses an owner password, stored scrypt-hashed in the shop's own database
  (`shop_secrets`, with the shop's own session-signing key).
- **Staff.** The owner adds staff logins in Staff and ticks the sections each
  person may open. Staff sign in at the shop's address; they never use
  Ariloo. Typing the owner password on a till opens the owner screens there
  for two hours ("Lock owner screens" closes them again).
- **Cookies** are httpOnly, signed with the shop's own key and scoped to the
  shop's path, so one device can be signed in to two shops.
- **What's new** (the bell) only lists changes made after the shop's
  `created_at`, so a new shop starts with an empty list.

### What Ariloo needs to provide

- Rows in `ariloo_shops` with `product = 'dukaloo'` and a `db_url` for each shop.
- The same `DUKALOO_SSO_SECRET` value, to sign the "Open Dukaloo" link.
- Refuse these as Dukaloo shop addresses, because they are the app's own
  paths (`lib/appRoots.ts`): `api`, `dashboard`, `login`, `owner-password`,
  `sw.js`, `offline.html`, `manifest.webmanifest`, `icon`, `apple-icon`.
- Nothing for time zones: each shop sets its own in Dukaloo's Settings.

## Products

- **Every product has variants.** A product without options has a single
  variant; a product with options (up to 3, such as Size and Colour) has one
  variant per combination. Only variants are sold, counted and labelled, and
  each has its own selling price, cost price, SKU, barcode and low-stock
  alert level. Turning a value off or removing it never loses the others'
  prices or codes.
- **Units** are built in and translated (piece, pack, box, pair, set, kg, g,
  L, mL, m, cm); weighed and measured units can be sold in parts.
- **Barcodes**: scan the manufacturer's code into the barcode field with a
  USB scanner (it types like a keyboard), type it, or press "Make barcode"
  for an in-store EAN-13 starting with `2`, from a per-shop counter. A
  barcode or SKU belongs to one live variant at a time (enforced by the
  database). On the products list, a scan anywhere on the page searches for
  that code (`components/use-scanner.ts`).
- **Labels**: "Print labels" opens a print window with Code 128 / EAN
  barcodes (bwip-js), the name, the variant and optionally the price, for
  50 × 30 mm or 38 × 25 mm label printers or A4 sheets (3 × 8).
- **Deleting** a product archives it (`archived_at`), so past sales and stock
  records can still name it; its barcodes and SKUs become free again.
- **Large catalogues**: the list is searched on the server (name, brand,
  SKU, barcode) and loaded 50 at a time.

## Conventions

- **Money** is integer cents (hundredths of the shop's currency, also for
  currencies shown without decimals); **quantities** are integer thousandths.
- **Formatting** (`lib/format.ts`) gives identical text on server and
  browser: Western digits, fixed grouping, month names from our own
  dictionaries, and times in the shop's time zone.
- **Time zone**: by default each device uses its own; it reports its zone
  in the `dukaloo_tz` cookie (`components/time-zone-sync.tsx`) so the
  server renders dates as that browser will. The owner can instead pick one
  zone for every device in Settings (`time_zone` in `shop_settings`).
- **Server-only code** (database, crypto, secrets) starts with
  `import "server-only"`; shared types and Zod schemas are client-safe.
- **Every API route and page checks access itself** and validates every
  field on the server.
- **Translations** live in `lib/i18n/{en,ku,ar,tr}.ts`, typed from English,
  so a missing key fails the build. The layout sets `dir="rtl"` for Kurdish
  and Arabic. Owners' corrections to any text are stored per language
  (`text_overrides`).
- **Design**: teal brand (replaced by each shop's own colour from Ariloo),
  amber accent, cool neutral surfaces; Plus Jakarta Sans for Latin text and
  Vazirmatn for Arabic script. Sidebar on tablets and computers, bottom bar
  on phones.

## Deploying

Changes land through pull requests into `main`; Vercel deploys production
from the merge commit. Don't push to `main` directly.

## Health check

`GET /<shop>/api/health` (signed in) runs `SELECT 1` on the shop's database
and returns `{"ok":true,"db":"ok"}`, or a 503 if it can't be reached.
