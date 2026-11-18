import { configWarnings } from "../config-warnings"

const good = {
  CUSTOM_ORDER_EMAIL: "hello@shop.com.au",
  STOREFRONT_URL: "https://shop.com.au",
  STRIPE_API_KEY: "sk_live_abc123",
  STRIPE_WEBHOOK_SECRET: "whsec_abc123",
}

describe("configWarnings", () => {
  it("is quiet for a real production setup", () => {
    expect(configWarnings({ NODE_ENV: "production", ...good } as NodeJS.ProcessEnv)).toEqual([])
  })
  it("warns about the example.com order address in any environment", () => {
    const w = configWarnings({ ...good, CUSTOM_ORDER_EMAIL: "orders@example.com" } as NodeJS.ProcessEnv)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain("CUSTOM_ORDER_EMAIL")
  })
  it("warns about localhost and placeholder Stripe keys in production only", () => {
    const bad = { ...good, STOREFRONT_URL: "http://localhost:8000", STRIPE_API_KEY: "sk_test_placeholder" }
    expect(configWarnings({ ...bad, NODE_ENV: "development" } as NodeJS.ProcessEnv)).toEqual([])
    const w = configWarnings({ ...bad, NODE_ENV: "production" } as NodeJS.ProcessEnv)
    expect(w).toHaveLength(2)
    expect(w.join(" ")).toContain("STOREFRONT_URL")
    expect(w.join(" ")).toContain("STRIPE")
  })
  it("warns loudly at boot in preview mode, and does not nag about missing Stripe keys then", () => {
    const env = { NODE_ENV: "production", ...good, CHECKOUT_PAUSED: "true", STRIPE_API_KEY: "", STRIPE_WEBHOOK_SECRET: "" } as NodeJS.ProcessEnv
    const w = configWarnings(env)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain("PREVIEW MODE")
    expect(w[0]).toContain("CHECKOUT_PAUSED=true")
  })
  it("has no preview-mode warning when CHECKOUT_PAUSED is not true", () => {
    for (const value of [undefined, "false", ""]) {
      expect(configWarnings({ NODE_ENV: "production", ...good, CHECKOUT_PAUSED: value } as NodeJS.ProcessEnv)).toEqual([])
    }
  })
})
