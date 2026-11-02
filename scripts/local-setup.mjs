#!/usr/bin/env node
/**
 * One-time local setup: database, settings, demo data, admin login.
 *
 *   pnpm setup:local              # starts Postgres + Redis with Docker
 *   pnpm setup:local --no-docker  # use your own Postgres/Redis from
 *                                 # DATABASE_URL and REDIS_URL
 *
 * Then run `pnpm dev` and open http://localhost:8000 (shop) and
 * http://localhost:9000/app (admin). Safe to run again: existing settings
 * files and data are kept.
 */
import { execSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const backend = join(root, "apps", "backend")
const storefront = join(root, "apps", "storefront")
const useDocker = !process.argv.includes("--no-docker")

const ADMIN_EMAIL = "admin@example.com"
const ADMIN_PASSWORD = "jewellery-admin"

const step = (text) => console.log(`\n▶ ${text}`)
const fail = (text) => {
  console.error(`\n✖ ${text}`)
  process.exit(1)
}
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit", shell: true })
const has = (cmd) => spawnSync(cmd, ["--version"], { shell: true, stdio: "ignore" }).status === 0

// 1. Tools
step("Checking tools")
const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 22 || (major === 22 && minor < 12)) {
  fail(`Node 22 or newer is needed (you have ${process.versions.node}). Get it from https://nodejs.org`)
}
if (!has("pnpm")) fail("pnpm is needed. Install it with: npm install -g pnpm")
if (useDocker && !has("docker")) {
  fail("Docker is needed (Docker Desktop: https://www.docker.com/products/docker-desktop). Or run with --no-docker and set DATABASE_URL and REDIS_URL.")
}

// 2. Database and Redis
let databaseUrl = process.env.DATABASE_URL
let redisUrl = process.env.REDIS_URL
if (useDocker) {
  step("Starting Postgres and Redis (Docker)")
  try {
    run("docker compose up -d --wait")
  } catch {
    fail("Docker could not start the containers. Is Docker Desktop running?")
  }
  databaseUrl = "postgres://medusa:medusa@localhost:5433/jewellery"
  redisUrl = "redis://localhost:6380"
} else if (!databaseUrl) {
  fail("With --no-docker, set DATABASE_URL (and optionally REDIS_URL) first.")
}

// 3. Backend settings (apps/backend/.env)
step("Writing backend settings")
const backendEnvPath = join(backend, ".env")
if (existsSync(backendEnvPath)) {
  console.log("  apps/backend/.env exists, kept as is.")
} else {
  const secret = () => randomBytes(24).toString("hex")
  const values = {
    STORE_CORS: "http://localhost:8000",
    ADMIN_CORS: "http://localhost:5173,http://localhost:9000",
    AUTH_CORS: "http://localhost:5173,http://localhost:9000,http://localhost:8000",
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl ?? "",
    JWT_SECRET: secret(),
    COOKIE_SECRET: secret(),
    STORE_NAME: "Jewellery Store",
    // Placeholders until the client's Stripe test keys arrive.
    STRIPE_API_KEY: "sk_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
    // Emails are printed in the backend terminal instead of sent.
    EMAIL_TRANSPORT: "console",
    EMAIL_FROM: "Jewellery Store <orders@example.com>",
    STORE_NOTIFY_EMAIL: "owner@example.com",
    CUSTOM_ORDER_EMAIL: "orders@example.com",
    STOREFRONT_URL: "http://localhost:8000/au",
  }
  // Start from the template so every documented setting is present.
  const template = readFileSync(join(backend, ".env.template"), "utf8")
  const seen = new Set()
  const lines = template.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/)
    if (match && match[1] in values) {
      seen.add(match[1])
      return `${match[1]}=${values[match[1]]}`
    }
    return line
  })
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`)
  }
  writeFileSync(backendEnvPath, lines.join("\n") + "\n")
  console.log("  Created apps/backend/.env")
}

// 4. Packages
step("Installing packages (first time takes a few minutes)")
run("pnpm install")

// 5. Database tables + demo data (categories, jewellery fields, 3 samples)
step("Creating database tables and demo data")
run("pnpm exec medusa db:migrate", backend)
step("Building the search index")
run("pnpm exec medusa exec ./src/scripts/reindex-search.ts", backend)

// 6. Admin login
step("Creating the admin login")
const user = spawnSync(`pnpm exec medusa user -e ${ADMIN_EMAIL} -p ${ADMIN_PASSWORD}`, {
  cwd: backend,
  shell: true,
  encoding: "utf8",
})
const userOutput = `${user.stdout}${user.stderr}`
if (user.status === 0 && !/error/i.test(userOutput)) {
  console.log("  Admin login created.")
} else if (/already exists|duplicate|unique/i.test(userOutput)) {
  console.log("  Admin login already exists, kept.")
} else {
  console.log(userOutput)
  console.log("  (Could not create the admin login; if you made one before, use that.)")
}

// 7. Storefront settings (apps/storefront/.env.local)
step("Writing storefront settings")
const storefrontEnvPath = join(storefront, ".env.local")
if (existsSync(storefrontEnvPath)) {
  console.log("  apps/storefront/.env.local exists, kept as is.")
} else {
  const output = execSync("pnpm exec medusa exec ./src/scripts/print-publishable-key.ts", {
    cwd: backend,
    encoding: "utf8",
  })
  const key = output.match(/PUBLISHABLE_KEY=(\S*)=END/)?.[1] ?? ""
  if (!key) fail("No storefront API key found in the database. Did the demo data step run?")
  writeFileSync(
    storefrontEnvPath,
    [
      `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${key}`,
      "NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000",
      "NEXT_PUBLIC_DEFAULT_REGION=au",
      "NEXT_PUBLIC_BASE_URL=http://localhost:8000",
      "NEXT_PUBLIC_STORE_NAME=Jewellery Store",
      "# Placeholder until the client's Stripe test keys arrive.",
      "NEXT_PUBLIC_STRIPE_KEY=pk_test_placeholder",
      "UCP_ENABLED=false",
      "",
    ].join("\n")
  )
  console.log("  Created apps/storefront/.env.local")
}

console.log(`
✔ Done. Start everything with:

    pnpm dev

Then open:
  Shop:   http://localhost:8000
  Admin:  http://localhost:9000/app
          email ${ADMIN_EMAIL}  password ${ADMIN_PASSWORD}

Emails (orders, custom-order requests, password resets) are printed in the
terminal running pnpm dev. Checkout needs real Stripe test keys first.
`)
