/**
 * Where custom order enquiries go. CUSTOM_ORDER_EMAIL, or the placeholder until the client gives
 * the real address. Not read at import time, so a test can set it.
 */
export function customOrderEmail(env: NodeJS.ProcessEnv = process.env): string {
  return env.CUSTOM_ORDER_EMAIL?.trim() || "orders@example.com"
}
