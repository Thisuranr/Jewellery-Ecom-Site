import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const redisUrl = process.env.REDIS_URL

// Redis-backed modules register only when REDIS_URL is set. Without it Medusa
// falls back to in-memory versions, which is fine for one local process.
const redisModules = redisUrl
  ? [
      { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl } },
      // Cache Module: the auth module keeps login challenges here.
      { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl } },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { redisUrl } },
      },
      {
        resolve: "@medusajs/medusa/caching",
        options: {
          providers: [
            {
              resolve: "@medusajs/caching-redis",
              id: "caching-redis",
              is_default: true,
              options: { redisUrl },
            },
          ],
        },
      },
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    workerMode: (process.env.WORKER_MODE || "shared") as
      | "shared"
      | "worker"
      | "server",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "/",
  },
  modules: [
    // Stripe is the only payment method (provider id pp_stripe_stripe).
    // Payment methods shown at checkout (cards, Apple/Google Pay, Afterpay,
    // Zip) are switched on in the Stripe dashboard, not here, because
    // automaticPaymentMethods lets Stripe decide what to offer.
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              // Charge when the order is placed. Refunds are done from the
              // order page in the admin.
              capture: true,
              automaticPaymentMethods: true,
              paymentDescription: process.env.STORE_NAME || "Jewellery order",
            },
          },
        ],
      },
    },
    ...redisModules,
  ],
})
