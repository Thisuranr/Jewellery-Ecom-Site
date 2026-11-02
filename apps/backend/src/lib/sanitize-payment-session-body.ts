import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * POST /store/payment-collections/:id/payment-sessions takes `{ provider_id, data }`, and
 * Medusa hands `data` straight to the Stripe provider, where it can override the
 * PaymentIntent (capture_method "manual", confirm, payment_method_data, ...). The storefront
 * sends only `provider_id`, so everything else is dropped here: a shopper must not be able to
 * change how their own payment is created.
 */
export function sanitizePaymentSessionBody(body: unknown): { provider_id?: unknown } {
  const provider_id = body !== null && typeof body === "object" ? (body as { provider_id?: unknown }).provider_id : undefined
  return provider_id === undefined ? {} : { provider_id }
}

export function stripPaymentSessionData(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  req.body = sanitizePaymentSessionBody(req.body)
  // Medusa's own validator has already copied the body into validatedBody, which is what the
  // route reads, so that copy must be cleaned as well.
  const request = req as MedusaRequest & { validatedBody?: unknown }
  if (request.validatedBody !== undefined) {
    request.validatedBody = sanitizePaymentSessionBody(request.validatedBody)
  }
  next()
}
