import { isProductionNodeEnv } from "./production-env"

const PLACEHOLDER = /placeholder|changeme|your[-_]|xxxx/iu

function isLocalUrl(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true
  }
  try {
    const host = new URL(value.trim()).hostname
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "[::1]"
  } catch {
    return true
  }
}

function isPlaceholderSecret(value: string | undefined): boolean {
  const v = value?.trim()
  return !v || PLACEHOLDER.test(v)
}

/**
 * Settings that are legal but wrong to ship. Warnings only, never a crash.
 * - CUSTOM_ORDER_EMAIL left on the example.com placeholder: custom order enquiries go nowhere (any environment).
 * - STOREFRONT_URL pointing at localhost, and Stripe keys that are placeholders: production only
 *   (both are normal while developing).
 */
export function configWarnings(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = []
  const to = env.CUSTOM_ORDER_EMAIL?.trim()
  if (!to || /@example\.(com|org|net)$/iu.test(to)) {
    out.push(
      "[config] CUSTOM_ORDER_EMAIL is not set to a real address (it is empty or on example.com): custom order enquiries will not reach the store."
    )
  }
  if (isProductionNodeEnv(env)) {
    if (isLocalUrl(env.STOREFRONT_URL)) {
      out.push(
        "[config] STOREFRONT_URL is empty or points at localhost in production: password-reset and order links will be broken."
      )
    }
    if (isPlaceholderSecret(env.STRIPE_API_KEY) || isPlaceholderSecret(env.STRIPE_WEBHOOK_SECRET)) {
      out.push(
        "[config] STRIPE_API_KEY or STRIPE_WEBHOOK_SECRET is empty or a placeholder in production: payments will fail."
      )
    }
  }
  return out
}
