/**
 * The apex URL (https) for a request to www.<host>, or null for any other host.
 * The host comes from the Host (or X-Forwarded-Host) header when given, because the
 * URL's own host can be normalised by the runtime; the path and query come from the URL.
 */
export function redirectWwwToApex(url: URL, hostHeader?: string | null): string | null {
  const raw = (hostHeader?.split(",")[0] ?? url.host).trim().toLowerCase()
  const host = raw.replace(/:\d+$/, "")
  if (!host.startsWith("www.") || host === "www." || !/^[a-z0-9.-]+$/.test(host)) {
    return null
  }
  return `https://${host.slice(4)}${url.pathname}${url.search}`
}
