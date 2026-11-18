import {
  assertProductionEnv,
  isProductionNodeEnv,
  nodeEnvLooksLikeProduction,
  productionChecksApply,
  productionEnvFailures,
} from "../production-env"

// Assembled at runtime so secret scanners do not mistake test values for real keys.
const fakeKey = (prefix: string) => prefix + ["51", "Test", "Only", "Not", "A", "Real", "Key"].join("x")

// A complete, valid production environment. Test values only: nothing real.
function production(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {
    NODE_ENV: "production",
    DATABASE_URL:
      "postgresql://postgres.abcdef:db-password-value@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
    DB_SSL: "true",
    DB_CA_PATH: "/run/secrets/supabase-ca.crt",
    REDIS_URL: "redis://:redis-password-value@redis:6379",
    JWT_SECRET: "jwt-0123456789abcdefghijklmnopqrstuvwxyz",
    COOKIE_SECRET: "cookie-0123456789abcdefghijklmnopqrstuvwxyz",
    STORE_CORS: "https://azira.com.au,https://www.azira.com.au",
    ADMIN_CORS: "https://admin.azira.com.au",
    AUTH_CORS: "https://admin.azira.com.au,https://azira.com.au",
    STOREFRONT_URL: "https://azira.com.au/au",
    MEDUSA_BACKEND_URL: "https://admin.azira.com.au",
    STRIPE_API_KEY: fakeKey("sk_live_"),
    STRIPE_WEBHOOK_SECRET: fakeKey("whsec_"),
    FILE_PROVIDER: "s3",
    FILE_URL: "https://img.azira.com.au",
    R2_ACCESS_KEY_ID: "0123456789abcdef0123456789abcdef",
    R2_SECRET_ACCESS_KEY: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    R2_ENDPOINT: "https://7b7865326875e0dea1285c31309d77a4.r2.cloudflarestorage.com",
    R2_BUCKET: "azira-images",
    EMAIL_TRANSPORT: "resend",
    RESEND_API_KEY: "re_AbCdEfGhIjKlMnOp_0123456789",
    EMAIL_FROM: "Azira <orders@azira.com.au>",
    STORE_NOTIFY_EMAIL: "owner@azira.com.au",
    CUSTOM_ORDER_EMAIL: "orders@azira.com.au",
    ...overrides,
  }
  for (const k of Object.keys(env)) {
    if (env[k] === undefined) delete env[k]
  }
  return env as NodeJS.ProcessEnv
}

const START = ["node", "medusa", "start"]

describe("production environment checks", () => {
  it("accepts a complete production environment", () => {
    expect(productionEnvFailures(production())).toEqual([])
    expect(() => assertProductionEnv(production(), START)).not.toThrow()
  })

  it("does nothing in development, test or with NODE_ENV unset", () => {
    for (const NODE_ENV of ["development", "test", undefined]) {
      const env = { NODE_ENV, DATABASE_URL: "" } as NodeJS.ProcessEnv
      expect(productionChecksApply(env, START)).toBe(false)
      expect(() => assertProductionEnv(env, START)).not.toThrow()
    }
    // The local-setup defaults (placeholders, console email) are fine in development.
    const dev = {
      NODE_ENV: "development",
      STRIPE_API_KEY: "sk_test_placeholder",
      STOREFRONT_URL: "http://localhost:8000/au",
    } as NodeJS.ProcessEnv
    expect(() => assertProductionEnv(dev, START)).not.toThrow()
  })

  it("skips `medusa build` (no secrets exist in the image build)", () => {
    const empty = { NODE_ENV: "production" } as NodeJS.ProcessEnv
    expect(() => assertProductionEnv(empty, ["node", "medusa", "build"])).not.toThrow()
    expect(() => assertProductionEnv(empty, ["node", "medusa", "--verbose", "build"])).not.toThrow()
  })

  it("stops every other command: start, db:migrate and exec", () => {
    const empty = { NODE_ENV: "production" } as NodeJS.ProcessEnv
    for (const cmd of ["start", "db:migrate", "exec", "develop"]) {
      expect(() => assertProductionEnv(empty, ["node", "medusa", cmd])).toThrow(/unsafe configuration/)
    }
    expect(() => assertProductionEnv(empty, ["node", "medusa"])).toThrow(/unsafe configuration/)
  })

  it("treats NODE_ENV=prod as production, and refuses a near-miss spelling", () => {
    expect(isProductionNodeEnv({ NODE_ENV: "prod" } as NodeJS.ProcessEnv)).toBe(true)
    expect(isProductionNodeEnv({ NODE_ENV: "Production" } as NodeJS.ProcessEnv)).toBe(false)
    expect(nodeEnvLooksLikeProduction({ NODE_ENV: "Production" } as NodeJS.ProcessEnv)).toBe(true)
    expect(() => assertProductionEnv({ NODE_ENV: " production" } as NodeJS.ProcessEnv, START)).toThrow(
      /NODE_ENV must be exactly/
    )
    // ... but `medusa build` with a near miss is still allowed.
    expect(() =>
      assertProductionEnv({ NODE_ENV: "Production" } as NodeJS.ProcessEnv, ["node", "medusa", "build"])
    ).not.toThrow()
  })

  it("lists every problem at once, naming variables and never values", () => {
    let message = ""
    try {
      assertProductionEnv(production({ JWT_SECRET: "short", STRIPE_API_KEY: "sk_test_placeholder" }), START)
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain("JWT_SECRET")
    expect(message).toContain("STRIPE_API_KEY")
    expect(message).not.toContain("sk_test_placeholder")
    expect(message).not.toContain("db-password-value")
  })

  // Each row: [what is wrong, overrides, the variable the failure must name].
  const cases: Array<[string, Record<string, string | undefined>, string]> = [
    ["DATABASE_URL missing", { DATABASE_URL: undefined }, "DATABASE_URL"],
    ["DATABASE_URL a placeholder", { DATABASE_URL: "postgresql://postgres:changeme@db:5432/postgres" }, "DATABASE_URL"],
    ["DB_SSL off", { DB_SSL: "false" }, "DB_SSL"],
    ["DB_SSL unset", { DB_SSL: undefined }, "DB_SSL"],
    ["DB_CA_PATH missing", { DB_CA_PATH: undefined }, "DB_CA_PATH"],
    ["REDIS_URL missing", { REDIS_URL: undefined }, "REDIS_URL"],
    ["REDIS_URL not redis", { REDIS_URL: "http://redis:6379" }, "REDIS_URL"],
    ["JWT_SECRET missing", { JWT_SECRET: undefined }, "JWT_SECRET"],
    ["JWT_SECRET default", { JWT_SECRET: "supersecret" }, "JWT_SECRET"],
    ["JWT_SECRET short", { JWT_SECRET: "abc" }, "JWT_SECRET"],
    ["JWT_SECRET placeholder", { JWT_SECRET: "changeme-changeme-changeme-changeme-123" }, "JWT_SECRET"],
    ["COOKIE_SECRET default", { COOKIE_SECRET: "supersecret" }, "COOKIE_SECRET"],
    ["STORE_CORS missing", { STORE_CORS: undefined }, "STORE_CORS"],
    ["STORE_CORS localhost", { STORE_CORS: "http://localhost:8000" }, "STORE_CORS"],
    ["ADMIN_CORS with localhost entry", { ADMIN_CORS: "https://admin.azira.com.au,https://localhost:9000" }, "ADMIN_CORS"],
    ["AUTH_CORS with a path", { AUTH_CORS: "https://azira.com.au/x" }, "AUTH_CORS"],
    ["AUTH_CORS a regex", { AUTH_CORS: "/azira\\.com\\.au$/" }, "AUTH_CORS"],
    ["STOREFRONT_URL localhost", { STOREFRONT_URL: "http://localhost:8000/au" }, "STOREFRONT_URL"],
    ["STOREFRONT_URL http", { STOREFRONT_URL: "http://azira.com.au" }, "STOREFRONT_URL"],
    ["MEDUSA_BACKEND_URL localhost", { MEDUSA_BACKEND_URL: "http://localhost:9000" }, "MEDUSA_BACKEND_URL"],
    ["STRIPE_API_KEY placeholder", { STRIPE_API_KEY: "sk_test_placeholder" }, "STRIPE_API_KEY"],
    ["STRIPE_API_KEY empty", { STRIPE_API_KEY: "" }, "STRIPE_API_KEY"],
    ["STRIPE_API_KEY a publishable key", { STRIPE_API_KEY: fakeKey("pk_live_") }, "STRIPE_API_KEY"],
    ["STRIPE_WEBHOOK_SECRET placeholder", { STRIPE_WEBHOOK_SECRET: "whsec_placeholder" }, "STRIPE_WEBHOOK_SECRET"],
    ["STRIPE_WEBHOOK_SECRET missing", { STRIPE_WEBHOOK_SECRET: undefined }, "STRIPE_WEBHOOK_SECRET"],
    ["FILE_PROVIDER local", { FILE_PROVIDER: "local" }, "FILE_PROVIDER"],
    ["FILE_PROVIDER unset", { FILE_PROVIDER: undefined }, "FILE_PROVIDER"],
    ["R2_ACCESS_KEY_ID missing", { R2_ACCESS_KEY_ID: undefined }, "R2_ACCESS_KEY_ID"],
    ["R2_SECRET_ACCESS_KEY placeholder", { R2_SECRET_ACCESS_KEY: "your-secret-here" }, "R2_SECRET_ACCESS_KEY"],
    ["R2_BUCKET missing", { R2_BUCKET: undefined }, "R2_BUCKET"],
    ["R2_ENDPOINT http", { R2_ENDPOINT: "http://account.r2.cloudflarestorage.com" }, "R2_ENDPOINT"],
    ["FILE_URL localhost", { FILE_URL: "http://localhost:9000/static" }, "FILE_URL"],
    ["EMAIL_TRANSPORT console", { EMAIL_TRANSPORT: "console" }, "EMAIL_TRANSPORT"],
    ["RESEND_API_KEY missing", { RESEND_API_KEY: undefined, EMAIL_TRANSPORT: "resend" }, "RESEND_API_KEY"],
    ["EMAIL_FROM missing", { EMAIL_FROM: undefined }, "EMAIL_FROM"],
    ["EMAIL_FROM on example.com", { EMAIL_FROM: "Azira <orders@example.com>" }, "EMAIL_FROM"],
    ["STORE_NOTIFY_EMAIL missing", { STORE_NOTIFY_EMAIL: undefined }, "STORE_NOTIFY_EMAIL"],
    ["STORE_NOTIFY_EMAIL on example.com", { STORE_NOTIFY_EMAIL: "owner@example.com" }, "STORE_NOTIFY_EMAIL"],
    ["CUSTOM_ORDER_EMAIL on example.com", { CUSTOM_ORDER_EMAIL: "orders@example.com" }, "CUSTOM_ORDER_EMAIL"],
    ["CUSTOM_ORDER_EMAIL empty", { CUSTOM_ORDER_EMAIL: "" }, "CUSTOM_ORDER_EMAIL"],
  ]

  it.each(cases)("refuses: %s", (_label, overrides, variable) => {
    const failures = productionEnvFailures(production(overrides))
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some((f) => f.includes(variable))).toBe(true)
  })

  it("accepts a real Stripe test key (a pre-launch run) and a restricted live key", () => {
    expect(productionEnvFailures(production({ STRIPE_API_KEY: fakeKey("sk_test_") }))).toEqual([])
    expect(productionEnvFailures(production({ STRIPE_API_KEY: fakeKey("rk_live_") }))).toEqual([])
  })

  it("does not demand settings the store does not use (no PayHere, MFA, pilot or invoice settings)", () => {
    const failures = productionEnvFailures(production()).join(" ")
    for (const word of ["PAYHERE", "MFA", "PILOT", "INVOICE", "STOREFRONT_SECRET", "SENTRY", "SUPPLIER"]) {
      expect(failures).not.toContain(word)
    }
  })
})
