# Dukaloo

Point of sale and shop management for retail shops. The second app sold
through Ariloo (https://ariloo.app); Restafe (Ashkaar/restafe) is the first
and the reference for the platform patterns. Never copy Restafe's café
features, and never copy from or push to the HelloCleaners repos.

## Shipping changes

- Never push to `main`. Work on a `claude/<feature>` branch and open a pull
  request; Vercel deploys production from the merge commit.
- Before opening a PR, run `npm run check` (`tsc --noEmit`, `eslint .`,
  `vitest run`, `next build`); all must be clean.
- Test in the browser too: a production build in many-shop mode against local
  SQLite files (a fake `ariloo_shops` table plus one file per shop), driven by
  Playwright: phone width, right-to-left Kurdish, dark mode. On the live site,
  only read-only checks; never create data there.
- Every feature ships with: texts in all 4 languages, a "What's new" entry
  (`lib/updates.ts` + `updates.items` in every dictionary) and a README update.
- Never commit secrets. New environment variables go in `.env.example` and the
  README, and the owner sets them in Vercel.

## Next.js 16

This Next.js has breaking changes from older versions. Read the relevant
guide in `node_modules/next/dist/docs/` before using an unfamiliar API.
`proxy.ts` replaces middleware. Cache Components and partial prefetching are
OFF on purpose: every page depends on the shop and the signed-in user.

## Conventions

- Colours come only from the tokens in `app/globals.css`: the `brand-*`,
  `accent-*` and `surface-*` scales and the semantic tokens (`background`,
  `card`, `primary`, `primary-soft`, `muted`, `highlight`, `border`, `ring`…),
  plus `red-*` for destructive actions. Never raw palette names such as
  `blue-*` or `slate-*`.
- UI is shadcn/ui-style components in `components/ui/` (Radix primitives via
  the `radix-ui` package, `cva`, `cn()` from `lib/utils.ts`). Icons from
  `lucide-react`; toasts from `sonner`.
- Right-to-left: use logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`,
  `end-`, `border-s`, `text-start`), never `ml-`/`mr-`/`left-`/`right-`.
  Flip directional icons with `rtl:-scale-x-100`.
- Money is integer cents (hundredths of the shop's currency); quantities are
  integer thousandths. No floats in the database or the API.
- Text shown on a server-rendered page must be identical on server and
  browser: format with `lib/format.ts` (fixed digits, our own month names,
  the shop's time zone), never `toLocaleString` or raw `Intl` with a locale.
- Server-only code (database, crypto, secrets) starts with
  `import "server-only"` and lives in files client components never import.
  Shared types and Zod schemas live in client-safe files under `lib/`.
- Every API route checks access itself (`requireSection`, `requireOwner`,
  `requireLogin` from `lib/api.ts`) and validates its body with Zod. The
  server works out prices and totals from the database, never from the browser.
- Every page checks access itself (`requireSectionPage` / `requireViewer`
  from `lib/pageAccess.ts`).
- Plans: `lib/plans.ts` is the only place that maps Ariloo plans to sections.
- Database: tables are created in code (`lib/db/setup.ts`: `SCHEMA` and
  `ADDED_COLUMNS`), queried with Drizzle (`lib/db/schema.ts`). Change both;
  `tests/schema.test.ts` checks they agree. Never edit a shipped CREATE TABLE.
  A new shop starts empty: no seed data.
- Translations: `lib/i18n/en.ts` is the source; `ku`, `ar`, `tr` are typed
  from it, so a missing key fails the build. Keep "Dukaloo" and "Ariloo" in
  Latin letters in every language.
- Offline: anything a till records must carry a `clientId` and be safe to
  send twice. Bump `VERSION` in `public/sw.js` when its caching changes.
- Never write to Ariloo's database. If Dukaloo needs a new column or setting
  from Ariloo, say so; that change is made in the Ariloo project.
