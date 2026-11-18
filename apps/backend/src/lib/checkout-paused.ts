import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Preview mode ("payments paused").
 *
 * CHECKOUT_PAUSED=true (exactly that, nothing else) lets the store run live
 * before Stripe and Resend exist: browsing works, nobody can pay. Anything
 * other than the exact text "true" means checkout is open, so a typo can never
 * silently pause a real shop. (In production a value other than true or false
 * is refused at boot, see production-env.ts.)
 *
 * While paused, the two routes through which an order can come into being are
 * refused with a 403 JSON error, whatever the storefront shows:
 *   POST /store/carts/:id/complete                       (turns a cart into an order)
 *   POST /store/payment-collections/:id/payment-sessions (opens a payment at the provider)
 * The flag is read on every request, so the answer always matches the
 * environment the process was started with.
 */
export function isCheckoutPaused(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CHECKOUT_PAUSED === "true"
}

export const CHECKOUT_PAUSED_CODE = "checkout_paused"
export const CHECKOUT_PAUSED_MESSAGE =
  "Online payments are not open yet. Please contact the store to place an order."

export function blockWhenCheckoutPaused(_req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (isCheckoutPaused()) {
    res.status(403).json({
      type: "not_allowed",
      code: CHECKOUT_PAUSED_CODE,
      message: CHECKOUT_PAUSED_MESSAGE,
    })
    return
  }
  next()
}
