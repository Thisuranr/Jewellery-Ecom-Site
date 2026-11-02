import { sanitizePaymentSessionBody, stripPaymentSessionData } from "../sanitize-payment-session-body"

describe("sanitizePaymentSessionBody", () => {
  it("drops data entirely and keeps provider_id", () => {
    expect(
      sanitizePaymentSessionBody({
        provider_id: "pp_stripe_stripe",
        data: { capture_method: "manual", confirm: true, payment_method_data: { type: "card" } },
      })
    ).toEqual({ provider_id: "pp_stripe_stripe" })
  })
  it("drops any other top-level field", () => {
    expect(sanitizePaymentSessionBody({ provider_id: "p", capture_method: "manual", amount: 1 })).toEqual({ provider_id: "p" })
  })
  it("copes with a missing or non-object body", () => {
    expect(sanitizePaymentSessionBody(undefined)).toEqual({})
    expect(sanitizePaymentSessionBody(null)).toEqual({})
    expect(sanitizePaymentSessionBody("x")).toEqual({})
    expect(sanitizePaymentSessionBody([{ data: 1 }])).toEqual({})
  })
  it("the middleware rewrites req.body and calls next", () => {
    const body = { provider_id: "pp_stripe_stripe", data: { capture_method: "manual" } }
    // Medusa's validator runs first and leaves a copy in validatedBody, which the route reads.
    const req = { body, validatedBody: { ...body } } as any
    const next = jest.fn()
    stripPaymentSessionData(req, {} as any, next)
    expect(req.body).toEqual({ provider_id: "pp_stripe_stripe" })
    expect(req.body.data).toBeUndefined()
    expect(req.validatedBody).toEqual({ provider_id: "pp_stripe_stripe" })
    expect(next).toHaveBeenCalledTimes(1)
  })
})
