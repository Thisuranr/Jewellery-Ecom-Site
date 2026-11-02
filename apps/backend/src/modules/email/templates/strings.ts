// Shared wording helpers for every email. Plain TypeScript (no React).

/** The shop's name in emails: STORE_NAME, read at render time. */
export function storeName(env: NodeJS.ProcessEnv = process.env): string {
  return env.STORE_NAME?.trim() || "the store"
}

/** `A$49.00`. Amounts are in major units (dollars), as Medusa stores them. */
export function formatAud(amount: number): string {
  const sign = amount < 0 ? "-" : ""
  const abs = Math.abs(amount)
  return `${sign}A$${abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The storefront base URL with the country code, no trailing slash. Default http://localhost:8000/au. */
export function storefrontUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.STOREFRONT_URL?.trim() || "http://localhost:8000/au"
  return raw.replace(/\/+$/u, "")
}
