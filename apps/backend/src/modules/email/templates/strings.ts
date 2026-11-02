// Shared wording helpers for every email. Plain TypeScript (no React).

/** The shop's name in emails: STORE_NAME, read at render time. */
export function storeName(env: NodeJS.ProcessEnv = process.env): string {
  return env.STORE_NAME?.trim() || "the store"
}

/** The seller's ABN for the tax invoice: STORE_ABN, or undefined when unset (the line is then left out). */
export function storeAbn(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.STORE_ABN?.trim() || undefined
}

const AUD = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })

/** `$49.00` (en-AU, as on the storefront). Amounts are in major units (dollars), as Medusa stores them. */
export function formatAud(amount: number): string {
  return AUD.format(amount)
}

/** The storefront base URL with the country code, no trailing slash. Default http://localhost:8000/au. */
export function storefrontUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.STOREFRONT_URL?.trim() || "http://localhost:8000/au"
  return raw.replace(/\/+$/u, "")
}
