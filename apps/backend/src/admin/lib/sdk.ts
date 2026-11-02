import Medusa from "@medusajs/js-sdk"

// Defined by the admin bundler from `admin.backendUrl` in medusa-config.ts
// (MEDUSA_BACKEND_URL, default "/"). Used instead of `import.meta.env`, which
// `tsc --noEmit` refuses in this CommonJS package (TS1470), and which would be
// undefined in a build unless VITE_BACKEND_URL were set.
declare const __BACKEND_URL__: string | undefined

/**
 * The admin's one client for our custom routes and uploads. Every admin page
 * and widget imports it from here ("../lib/sdk"); do not create another
 * instance. Session auth: the dashboard is already signed in (plan M1 B7).
 */
export const sdk = new Medusa({
  baseUrl: (typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__) || "/",
  auth: { type: "session" },
})
