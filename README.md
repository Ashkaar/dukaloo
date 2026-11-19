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
| Till: scanner, cart, discounts, mixed payments, tax, receipts; sales by day with reprint and void | Done |
| Returns and refunds | Done |
| Camera barcode scanning | Done |
| Customers: list, history, picked at the till, on receipts | Done |
| Stock levels and quick adjustments | Done |
| Purchases and suppliers | Done |
| Stock counts, low-stock alerts | Planned |
| Expenses | Done |
| Invoices | Planned |
| Offline: product catalogue on the device, outbox, background sync, installable app | Planned |
| Reports and backups | Done |

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
- **Camera scanning** (`components/camera-scanner.tsx`): on phones and
  tablets without a scanner, the camera button reads barcodes with the
  browser's BarcodeDetector where it exists (Chrome on Android and
  computers) and otherwise with ZXing (`@zxing/browser`, loaded only when
  the camera opens; Safari and iPhones). On the till it stays open and
  adds every scan to the cart, with a beep; in a barcode field or search
  it closes after one code.
- **Labels**: "Print labels" opens a print window with Code 128 / EAN
  barcodes (bwip-js), the name, the variant and optionally the price, for
  50 × 30 mm or 38 × 25 mm label printers or A4 sheets (3 × 8).
- **Deleting** a product archives it (`archived_at`), so past sales and stock
  records can still name it; its barcodes and SKUs become free again.
- **Large catalogues**: the list is searched on the server (name, brand,
  SKU, barcode) and loaded 50 at a time.

## Till and sales

- **Selling**: scan a barcode (USB scanners type into the page; a scan
  works with or without the search box focused), type an SKU, search, or
  tap a product. Tap a cart line to change its quantity (parts of a unit
  for kg, L, m…) or give it a discount; the % button gives a discount on
  the whole sale.
- **Paying**: cash, card or transfer (bank and wallet apps), or several of
  them on one sale. Card and transfer can't exceed the total; change is
  worked out from cash.
- **The server decides the totals**: the till sends variant ids,
  quantities, discounts and payments; the server prices them from the
  database with the same function the till uses (`lib/sale.ts`), refuses
  the sale if the total differs from what the cashier saw, and records the
  sale, its lines, payments and stock movements in one transaction. Each
  sale carries a `clientId`, so a retry never records it twice.
- **Settings → Selling** (owner): whether the till may sell items whose
  stock shows zero (on by default, since a new shop has entered no stock;
  when off, the server refuses too), tax/VAT (name, rate, and whether shelf
  prices include it), and the receipt's top and bottom text and paper
  width (58 or 80 mm). In shops without decimals every amount is rounded to
  whole units.
- **Receipts** print in their own window (`components/sales/print-receipt.ts`).
  With Chrome's `--kiosk-printing` they go straight to the default printer;
  a cash drawer wired to the receipt printer opens when the printer driver
  is set to open the drawer on print.
- **Sales** lists each day's sales (in the shop's time zone) with totals by
  payment method; any sale can be reprinted, and the owner can void one
  (it stays in the records, and its items go back into stock).
- **Returns** (owner, or the owner password entered on the device): from a
  sale in Sales, give back some or all of its items. The refund is each
  item's share of what the customer paid (`refundFor` in `lib/sale.ts`), so
  sale discounts and added tax are refunded in proportion; returning the
  last of a line refunds exactly what is left of it. The refund is paid by
  cash, card or transfer and subtracted from that day's takings; counted
  items go back into stock; a return slip can be printed. A sale with
  returns can't be voided (return the rest instead).
- **Customers**: a list searched by name or phone (kept as digits, so
  "0750 123 4567" and "07501234567" are one person, and a phone belongs to
  one customer). At the till, "Add a customer" finds one or adds one with
  just a name and phone; the sale and receipt carry their name. Each
  customer's page shows their purchases, visits and total spent (less
  refunds). Deleting a customer hides them; past sales keep the name.
- **Purchases** (Purchases section, with a Suppliers tab): scan, search or
  pick what came in, with quantity and cost each, the supplier and their
  invoice number. Receiving puts counted items into stock and (by default)
  sets each item's cost price to what was paid, so profit stays right. The
  owner can cancel a purchase entered by mistake; its stock goes back out.
- **Expenses**: the shop's own expense types (it starts with none), and
  expenses with a date, amount, type, payment method and note, listed by
  month with totals per type. Staff with the section can add expenses; only
  the owner can delete one (kept in the database, gone from the books).
- **Stock** is a list of movements (`stock_moves`: opening, count, adjust,
  sale, void, and later purchase and return); the level is their sum.
  Products can be set not to count stock (services). The product editor
  shows each variant's level, with a quick "Adjust" (set a count, add,
  remove).

## Reports and backups

- **Reports** (`lib/reportsDb.ts`, worked out in SQL so a whole year stays
  fast): for today, yesterday, the last 7 days, this or last month, this
  year, or chosen dates. Net sales (sales less refunds given in the period),
  tax collected (not income), cost of goods sold (each line's cost at the
  time of sale, less returned items), gross profit and margin, expenses,
  net profit, average sale; net sales per day as a chart; top products,
  sales by category, payment method (after change and refunds) and
  person; expenses by type; stock value at cost and at selling price; and
  items at or below their low-stock level. Voided sales never count. The
  daily figures can be downloaded as CSV, and the page prints.
- **Backup** (Settings, owner): one JSON file with every table of the
  shop's data. The server sends it a table and 2,000 rows at a time
  (`/api/backup`) and the browser builds the file, so no response gets too
  big. Sign-in secrets and staff password hashes are left out.

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
