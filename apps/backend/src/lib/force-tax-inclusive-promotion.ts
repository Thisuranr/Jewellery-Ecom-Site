import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Every price in this store includes GST, so a fixed-amount promotion must be
 * tax-inclusive too. The admin's promotion form defaults the "tax inclusive"
 * switch to off, and then a "$10 off" code takes $10 off the pre-GST price, so
 * the customer saves $11. This forces the flag on when a promotion is created,
 * and whenever an update touches it. (Percentage promotions ignore the flag.)
 */
export function withTaxInclusive(body: unknown, creating: boolean): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return body
  }
  const record = body as Record<string, unknown>
  if (creating || "is_tax_inclusive" in record) {
    return { ...record, is_tax_inclusive: true }
  }
  return body
}

function middleware(creating: boolean) {
  return (req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) => {
    req.body = withTaxInclusive(req.body, creating)
    // Medusa's validator runs first and the route reads validatedBody.
    const request = req as MedusaRequest & { validatedBody?: unknown }
    if (request.validatedBody !== undefined) {
      request.validatedBody = withTaxInclusive(request.validatedBody, creating)
    }
    next()
  }
}

export const forceTaxInclusiveOnCreate = middleware(true)
export const forceTaxInclusiveOnUpdate = middleware(false)
