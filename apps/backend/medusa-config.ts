import { loadEnv, defineConfig } from "@medusajs/framework/utils"
import { databaseDriverOptions } from "./src/lib/database-tls"
import { emailNotificationModule } from "./src/lib/email-config"
import { fileModuleConfig } from "./src/lib/file-storage"
import { assertProductionEnv } from "./src/lib/production-env"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// With NODE_ENV=production, every command except `medusa build` stops here,
// listing every missing, unsafe or placeholder setting (database TLS, Redis,
// secrets, CORS, Stripe, R2, Resend, public URLs) by name. See
// src/lib/production-env.ts. Development is not affected.
assertProductionEnv(process.env, process.argv)

// Always explicit, for the server's pg pool and for the MikroORM connections
// `medusa db:migrate` opens: { ssl: false } for a local database, verified TLS
// ({ rejectUnauthorized: true, ca } from DB_CA_PATH) when DB_SSL=true. Throws
// here, before any connection, for a remote database without DB_SSL=true or a
// DATABASE_URL the two connection paths would read differently. See
// src/lib/database-tls.ts.
const dbDriverOptions = databaseDriverOptions()

const redisUrl = process.env.REDIS_URL

// Empty or unset STRIPE_API_KEY: no Stripe provider (preview mode only; the
// production check refuses an empty key unless CHECKOUT_PAUSED=true).
const stripeConfigured = !!process.env.STRIPE_API_KEY?.trim()

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
    databaseDriverOptions: dbDriverOptions,
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
  // Medusa's translation module backs the attribute labels (English only
  // for now, but adding a language later needs no data model change).
  featureFlags: {
    translation: true,
  },
  modules: [
    { resolve: "@medusajs/medusa/translation" },
    // File storage: the local provider in development, Cloudflare R2 through the
    // S3 provider when FILE_PROVIDER=s3 (production). Replaces defineConfig's
    // default local provider; see src/lib/file-storage.ts.
    fileModuleConfig(),
    // Jewellery attributes (material type, purity, colour...). See
    // src/modules/attributes.
    { resolve: "./src/modules/attributes" },
    // Custom order enquiries from the storefront form. See src/modules/custom-enquiry.
    { resolve: "./src/modules/custom-enquiry" },
    // Transactional email: console transport (logged) until RESEND_API_KEY is set. Keeps
    // Medusa's local "feed" provider too. See src/lib/email-config.ts.
    emailNotificationModule(),
    // Stripe is the only payment method (provider id pp_stripe_stripe).
    // Payment methods shown at checkout (cards, Apple/Google Pay, Afterpay,
    // Zip) are switched on in the Stripe dashboard, not here, because
    // automaticPaymentMethods lets Stripe decide what to offer.
    // Registered only when STRIPE_API_KEY is set: in preview mode
    // (CHECKOUT_PAUSED=true, production-env.ts) there is no key, and the
    // checkout routes are refused anyway (src/lib/checkout-paused.ts).
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: stripeConfigured
          ? [
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
                  paymentDescription: process.env.STORE_NAME || "Azira",
                },
              },
            ]
          : [],
      },
    },
    ...redisModules,
  ],
})
