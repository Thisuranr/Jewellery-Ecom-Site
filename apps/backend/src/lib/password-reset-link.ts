import { storefrontUrl } from "../modules/email/templates/strings"

/**
 * The reset link for an `auth.password_reset` event, or null when the event is not one we mail.
 * Customers reset on the storefront, admin users in the Medusa admin app. The token is in the
 * link only; nothing here logs it.
 */
export function passwordResetLink(
  event: { entity_id?: unknown; actor_type?: unknown; token?: unknown },
  env: NodeJS.ProcessEnv = process.env
): { email: string; url: string } | null {
  const { entity_id: email, actor_type: actor, token } = event
  if (typeof email !== "string" || !email.includes("@") || typeof token !== "string" || !token) {
    return null
  }
  const query = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  if (actor === "customer") {
    // storefrontUrl() already ends in the country segment (e.g. http://localhost:8000/au).
    return { email, url: `${storefrontUrl(env)}/account/reset-password?${query}` }
  }
  if (actor === "user") {
    const backend = env.MEDUSA_BACKEND_URL?.trim()
    const base = backend && /^https?:\/\//u.test(backend) ? backend.replace(/\/+$/u, "") : "http://localhost:9000"
    return { email, url: `${base}/app/reset-password?${query}` }
  }
  return null
}
