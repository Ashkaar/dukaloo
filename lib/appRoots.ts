// The app's own first path segments. Anything else in first place is a
// shop's address (proxy.ts). Ariloo must refuse these names as Dukaloo
// shop addresses.
export const APP_ROOTS: ReadonlySet<string> = new Set([
  "api",
  "dashboard",
  "login",
  "owner-password",
  "sw.js",
  "offline.html",
  "manifest.webmanifest",
  "icon",
  "apple-icon",
]);
