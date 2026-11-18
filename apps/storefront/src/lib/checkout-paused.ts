/**
 * Preview mode ("payments paused"), storefront side.
 *
 * NEXT_PUBLIC_CHECKOUT_PAUSED=true (exactly that) is baked into the build. The bag and the
 * drawer then show a short note instead of the Checkout buttons, and /checkout shows the same
 * note instead of the steps. Any other value, or none, leaves checkout as it is. The backend
 * enforces the same flag (CHECKOUT_PAUSED) and refuses to complete a cart, so this is only the
 * friendly half. NEXT_PUBLIC_* values are inlined at build time, so the process.env reference
 * below must stay written out in full.
 */
export const isCheckoutPausedValue = (value: string | undefined): boolean => value === "true"

export const CHECKOUT_PAUSED = isCheckoutPausedValue(process.env.NEXT_PUBLIC_CHECKOUT_PAUSED)
