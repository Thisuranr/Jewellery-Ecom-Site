import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  blockWhenCheckoutPaused,
  CHECKOUT_PAUSED_CODE,
  isCheckoutPaused,
} from "../checkout-paused"
import middlewares from "../../api/middlewares"

function run() {
  const next = jest.fn()
  const json = jest.fn()
  const status = jest.fn(() => ({ json }))
  blockWhenCheckoutPaused({} as MedusaRequest, { status } as unknown as MedusaResponse, next)
  return { next, json, status }
}

describe("checkout paused (preview mode)", () => {
  const saved = process.env.CHECKOUT_PAUSED
  afterEach(() => {
    if (saved === undefined) delete process.env.CHECKOUT_PAUSED
    else process.env.CHECKOUT_PAUSED = saved
  })

  it("is paused only for the exact text true", () => {
    expect(isCheckoutPaused({ CHECKOUT_PAUSED: "true" } as NodeJS.ProcessEnv)).toBe(true)
    for (const value of [undefined, "", "false", "TRUE", "True", "1", "yes", " true"]) {
      expect(isCheckoutPaused({ CHECKOUT_PAUSED: value } as NodeJS.ProcessEnv)).toBe(false)
    }
  })

  it("answers 403 with a JSON message and never calls next while paused", () => {
    process.env.CHECKOUT_PAUSED = "true"
    const { next, json, status } = run()
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ type: "not_allowed", code: CHECKOUT_PAUSED_CODE, message: expect.stringContaining("not open") }))
    expect(next).not.toHaveBeenCalled()
  })

  it("only calls next when not paused", () => {
    for (const value of [undefined, "false", "", "TRUE"]) {
      if (value === undefined) delete process.env.CHECKOUT_PAUSED
      else process.env.CHECKOUT_PAUSED = value
      const { next, status } = run()
      expect(next).toHaveBeenCalledTimes(1)
      expect(status).not.toHaveBeenCalled()
    }
  })

  it("reads the flag on every request", () => {
    process.env.CHECKOUT_PAUSED = "true"
    expect(run().status).toHaveBeenCalledWith(403)
    process.env.CHECKOUT_PAUSED = "false"
    expect(run().next).toHaveBeenCalled()
  })

  it("is wired in front of cart completion and payment-session creation, keeping the sanitiser", () => {
    const routes = ((middlewares as unknown) as { routes: Array<{ methods?: string[]; matcher: string; middlewares: unknown[] }> }).routes
    const complete = routes.find((r) => r.matcher === "/store/carts/:id/complete")
    expect(complete?.methods).toEqual(["POST"])
    expect(complete?.middlewares[0]).toBe(blockWhenCheckoutPaused)

    const sessions = routes.find((r) => r.matcher === "/store/payment-collections/:id/payment-sessions")
    expect(sessions?.methods).toEqual(["POST"])
    expect(sessions?.middlewares[0]).toBe(blockWhenCheckoutPaused)
    expect(sessions?.middlewares).toHaveLength(2)
  })
})
