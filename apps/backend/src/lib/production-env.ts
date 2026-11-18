import { MedusaError } from "@medusajs/framework/utils"
import { emailProviderOptionsFromEnv } from "./email-config"
import { isMailbox } from "../modules/email/lib/address"

/**
 * Production config fails closed.
 *
 * medusa-config.ts calls assertProductionEnv() first, so with NODE_ENV=production
 * a missing, unsafe or still-placeholder setting stops `medusa start`,
 * `db:migrate`, `exec` (and every other command) at config load, before anything
 * connects. Only `medusa build` is skipped: it runs in CI and in the Docker build
 * stage without secrets. Every failure is listed in one error that names
 * variables, never values. Development and test runs are not affected.
 *
 * Production means what Medusa means by it: NODE_ENV "production" or "prod"
 * (@medusajs/utils/dist/common/is-production.js), which is also what makes the
 * session cookie Secure.
 */

const PRODUCTION_NODE_ENVS = new Set(["production", "prod"])

/** NODE_ENV says production, as Medusa reads it ("production" or "prod"). */
export function isProductionNodeEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return PRODUCTION_NODE_ENVS.has(env.NODE_ENV ?? "")
}

/** NODE_ENV is a near miss of "production" or "prod" (case or spaces): never a real setting. */
export function nodeEnvLooksLikeProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.NODE_ENV ?? ""
  return !PRODUCTION_NODE_ENVS.has(raw) && PRODUCTION_NODE_ENVS.has(raw.trim().toLowerCase())
}

// Commands that never need the production secrets.
const SKIPPED_COMMANDS = new Set(["build"])

const DEFAULT_SECRET = "supersecret"
const MIN_SECRET_LENGTH = 32

// Loopback or local names: never allowed in production URLs or CORS origins.
const LOCAL_HOST = /(^|\.)localhost$|^127\.|^\[?::1\]?$|^0\.0\.0\.0$|^\[?::\]?$/i

// A value that is a template or example, not a real setting.
const PLACEHOLDER = /placeholder|changeme|change-me|your[-_]|xxxx|replace[-_]?me|\bTBC\b|<[^>]*>/i
const EXAMPLE_DOMAIN = /@(?:[a-z0-9-]+\.)*example\.(com|org|net|test|invalid)\b/i

// The medusa CLI command: the first argument after the script that is not an
// option (yargs reads it from there).
function medusaCommand(argv: readonly string[]): string | undefined {
  return argv.slice(2).find((arg) => !arg.startsWith("-"))
}

export function productionChecksApply(env: NodeJS.ProcessEnv, argv: readonly string[]): boolean {
  if (!isProductionNodeEnv(env)) {
    return false
  }
  const command = medusaCommand(argv)
  return !(command && SKIPPED_COMMANDS.has(command))
}

const blank = (value: string | undefined): boolean => !value || value.trim() === ""

function isPlaceholder(value: string | undefined): boolean {
  return blank(value) || PLACEHOLDER.test(value!)
}

function isLocalHost(hostname: string): boolean {
  return /localhost/i.test(hostname) || LOCAL_HOST.test(hostname)
}

// A public https URL (a base URL; a path is allowed).
function isPublicHttpsUrl(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !isLocalHost(url.hostname) && value.startsWith("https://")
  } catch {
    return false
  }
}

// A CORS entry must be exactly a public https origin: Medusa compares the
// browser's Origin header with each comma-separated entry as written, and turns
// /.../ entries into regular expressions, which are refused here.
function isPublicHttpsOrigin(entry: string): boolean {
  try {
    const url = new URL(entry)
    return url.origin === entry && url.protocol === "https:" && !isLocalHost(url.hostname)
  } catch {
    return false
  }
}

function weakSecret(value: string | undefined): boolean {
  return (
    !value ||
    value.toLowerCase() === DEFAULT_SECRET ||
    value.length < MIN_SECRET_LENGTH ||
    PLACEHOLDER.test(value)
  )
}

function realEmail(value: string | undefined): boolean {
  const v = value?.trim()
  return !!v && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) && !EXAMPLE_DOMAIN.test(v)
}

/** The failures for a production environment, naming variables only. */
export function productionEnvFailures(env: NodeJS.ProcessEnv): string[] {
  const failures: string[] = []

  // Database: Supabase, verified TLS. The TLS guard (database-tls.ts) checks the
  // URL itself and the CA file at config load.
  if (blank(env.DATABASE_URL)) {
    failures.push("DATABASE_URL is not set")
  } else if (isPlaceholder(env.DATABASE_URL)) {
    failures.push("DATABASE_URL is still a placeholder")
  }
  if (env.DB_SSL !== "true") {
    failures.push('DB_SSL must be "true" (verified TLS to the database)')
  } else if (blank(env.DB_CA_PATH)) {
    failures.push("DB_SSL=true requires DB_CA_PATH (the database CA certificate)")
  }

  if (!env.REDIS_URL) {
    failures.push("REDIS_URL is not set (admin sessions, the event bus, workflows, cache and locks need Redis)")
  } else if (!/^rediss?:\/\//i.test(env.REDIS_URL)) {
    failures.push("REDIS_URL must be a redis:// or rediss:// URL")
  }

  for (const name of ["JWT_SECRET", "COOKIE_SECRET"]) {
    if (weakSecret(env[name])) {
      failures.push(
        `${name} must be a random value of at least ${MIN_SECRET_LENGTH} characters ` +
          "(not the Medusa default or a placeholder)"
      )
    }
  }

  for (const name of ["STORE_CORS", "ADMIN_CORS", "AUTH_CORS"]) {
    const value = env[name]
    if (blank(value)) {
      failures.push(`${name} must be set to the https:// origin(s) allowed to call this server`)
      continue
    }
    const bad = value!
      .split(",")
      .map((entry, i) => (isPublicHttpsOrigin(entry) ? 0 : i + 1))
      .filter(Boolean)
    if (bad.length) {
      failures.push(
        `${name} entr${bad.length > 1 ? "ies" : "y"} ${bad.join(", ")} must be an exact ` +
          "https:// origin, not localhost (no paths, spaces, wildcards or patterns)"
      )
    }
  }

  // Public URLs: emails link to them, and the admin bundle is built for one.
  for (const name of ["STOREFRONT_URL", "MEDUSA_BACKEND_URL"]) {
    if (!isPublicHttpsUrl(env[name])) {
      failures.push(`${name} must be a public https:// URL (not localhost)`)
    }
  }

  // Payments: Stripe. Placeholders such as sk_test_placeholder are refused.
  const stripeKey = env.STRIPE_API_KEY?.trim()
  if (!stripeKey || isPlaceholder(stripeKey) || !/^(sk|rk)_(live|test)_[A-Za-z0-9]{8,}$/.test(stripeKey)) {
    failures.push("STRIPE_API_KEY must be a real Stripe secret key (sk_live_... or rk_live_...), not empty or a placeholder")
  }
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret || isPlaceholder(webhookSecret) || !/^whsec_[A-Za-z0-9]{8,}$/.test(webhookSecret)) {
    failures.push("STRIPE_WEBHOOK_SECRET must be the webhook endpoint's signing secret (whsec_...), not empty or a placeholder")
  }

  // Files: Cloudflare R2 through the S3 provider.
  if (env.FILE_PROVIDER !== "s3") {
    failures.push('FILE_PROVIDER must be "s3" (uploads go to the R2 bucket, not the server disk)')
  } else {
    for (const name of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      if (isPlaceholder(env[name])) {
        failures.push(`${name} must be set (the Cloudflare R2 settings)`)
      }
    }
    if (!isPublicHttpsUrl(env.R2_ENDPOINT)) {
      failures.push("R2_ENDPOINT must be an https:// URL (https://<account id>.r2.cloudflarestorage.com)")
    }
    if (!isPublicHttpsUrl(env.FILE_URL)) {
      failures.push("FILE_URL must be the bucket's public https:// URL (https://img.azira.com.au)")
    }
  }

  // Email: Resend. A log-only transport reaches no customer.
  const email = emailProviderOptionsFromEnv(env)
  if (email.transport !== "resend") {
    failures.push(
      'EMAIL_TRANSPORT must be "resend" in production (a log-only transport sends nothing, ' +
        "so password resets and order emails never arrive)"
    )
  }
  if (!email.api_key || isPlaceholder(email.api_key)) {
    failures.push("RESEND_API_KEY must be set (production sends email through Resend)")
  }
  if (!email.from || !isMailbox(email.from) || EXAMPLE_DOMAIN.test(email.from)) {
    failures.push('EMAIL_FROM must be a valid sender on your own domain, "name@azira.com.au" or "Azira <name@azira.com.au>"')
  }

  // The owner's inboxes.
  for (const name of ["CUSTOM_ORDER_EMAIL", "STORE_NOTIFY_EMAIL"]) {
    if (!realEmail(env[name])) {
      failures.push(`${name} must be a real email address (not empty, not example.com)`)
    }
  }

  return failures
}

/**
 * Throws, listing every failure, when NODE_ENV is production and the command
 * is not `medusa build`. Does nothing otherwise.
 */
export function assertProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv
): void {
  // "Production", " production" or "PROD" is not production to Medusa, so every
  // check below would be skipped on what is meant to be the live server. Refuse it instead.
  const command = medusaCommand(argv)
  if (nodeEnvLooksLikeProduction(env) && !(command && SKIPPED_COMMANDS.has(command))) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      'Refusing to run: NODE_ENV must be exactly "production" (it is set to a different spelling, ' +
        "so the production checks would not run)"
    )
  }
  if (!productionChecksApply(env, argv)) {
    return
  }
  const failures = productionEnvFailures(env)
  if (failures.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      "Refusing to run in production with unsafe configuration:\n" + failures.map((f) => `- ${f}`).join("\n")
    )
  }
}
