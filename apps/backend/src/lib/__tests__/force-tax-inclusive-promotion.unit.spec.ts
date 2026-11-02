import { forceTaxInclusiveOnCreate, forceTaxInclusiveOnUpdate, withTaxInclusive } from "../force-tax-inclusive-promotion"

describe("withTaxInclusive", () => {
  it("forces the flag on when creating, even if the form sent false", () => {
    expect(withTaxInclusive({ code: "TEN", is_tax_inclusive: false }, true)).toEqual({ code: "TEN", is_tax_inclusive: true })
    expect(withTaxInclusive({ code: "TEN" }, true)).toEqual({ code: "TEN", is_tax_inclusive: true })
  })
  it("on update, only overrides when the flag is sent", () => {
    expect(withTaxInclusive({ status: "active" }, false)).toEqual({ status: "active" })
    expect(withTaxInclusive({ is_tax_inclusive: false }, false)).toEqual({ is_tax_inclusive: true })
  })
  it("leaves non-objects alone", () => {
    expect(withTaxInclusive(undefined, true)).toBeUndefined()
    expect(withTaxInclusive([1], true)).toEqual([1])
  })
  it("cleans validatedBody as well as body", () => {
    const req: any = { body: { is_tax_inclusive: false }, validatedBody: { is_tax_inclusive: false } }
    const next = jest.fn()
    forceTaxInclusiveOnCreate(req, {} as any, next)
    expect(req.body.is_tax_inclusive).toBe(true)
    expect(req.validatedBody.is_tax_inclusive).toBe(true)
    expect(next).toHaveBeenCalled()
    const upd: any = { body: { status: "active" } }
    forceTaxInclusiveOnUpdate(upd, {} as any, next)
    expect(upd.body).toEqual({ status: "active" })
  })
})
