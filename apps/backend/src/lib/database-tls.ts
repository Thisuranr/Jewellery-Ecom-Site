import { readFileSync } from "node:fs"
import { join } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
// The parser pg uses for connectionString (pinned to the version pg depends
// on), so the guard sees the host and params the server's pg pool will use.
import { parse } from "pg-connection-string"

/**
 * Database TLS for medusa-config (re-check fix, bug 2).
 *
 * Medusa opens the database two ways, and both must get the same host and the
 * same TLS settings:
 * - the server's shared pg pool (framework pg-connection-loader ->
 *   createPgConnection): pg parses DATABASE_URL itself, so `?host=` and the
 *   ssl* params win over anything in the config;
 * - MikroORM, which `medusa db:migrate` uses for every module's migrations:
 *   it reads only `new URL(clientUrl).hostname` and ignores the query.
 * When databaseDriverOptions is not set, Medusa's loadDatabaseConfig picks TLS
 * itself: ssl: false whenever "localhost" appears anywhere in the URL, and TLS
 * without certificate checks otherwise.
 *
 * So the rule is simple and strict:
 * - DATABASE_URL is a postgres:// or postgresql:// URL that both parsers read,
 *   with exactly one host and no host, hostaddr, ssl* or uselibpqcompat param;
 * - the database is local only when that host (or PGHOST, when the URL's host
 *   is empty or DATABASE_URL is unset) is localhost, 127.0.0.1, ::1 or a
 *   unix-socket directory;
 * - anything else needs DB_SSL=true, which requires the CA at DB_CA_PATH;
 * - medusa-config always passes the result as databaseDriverOptions, so
 *   Medusa's own heuristic never decides.
 *
 * Messages name the host or the param names only, never the URL (it carries
 * the password).
 *
 * Side paths closed in M2 (B2), all checked here because medusa-config loads
 * before any of them connects:
 * - `medusa db:create` / `db:setup` open their own pg.Client from the URL with
 *   no driver options, and read DATABASE_URL from <cwd>/.env themselves
 *   (@medusajs/medusa/dist/commands/db/create.js:32-97), so they are refused
 *   unless every URL they could use names a local host;
 * - MikroORM merges MIKRO_ORM_* variables over Medusa's options at init, and
 *   copies MIKRO_ORM_* keys from <cwd>/.env into process.env first
 *   (@mikro-orm/core/MikroORM.js:28-38, utils/ConfigurationLoader.js:212-221),
 *   so any of them, in the environment or in that file, is refused;
 * - ?port=, ?user=, ?password=, ?database= and ?dbname= are refused (pg uses
 *   the first three, MikroORM none);
 * - a percent-encoded "/" or "\" in the URL's host, and a socket path that
 *   starts with "//" or holds "\" (a Windows named pipe can be remote).
 */

export type DatabaseDriverOptions = {
  connection: { ssl: false | { rejectUnauthorized: true; ca: string } }
}

export type DatabaseGuardOptions = {
  /** The command line, to recognise `medusa db:create` / `db:setup`. */
  argv?: readonly string[]
  /** The project root: where db:create and MikroORM read `.env`. */
  cwd?: string
}

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

// pg-connection-string copies every query param into pg's config, and these
// win over the URL's own port and credentials; MikroORM reads only the URL's
// own parts. database and dbname are ignored by pg-connection-string 2.14 (the
// path wins), and refused all the same.
const CONNECTION_PARAM = /^(port|user|password|database|dbname)$/i

// A "/" or "\" smuggled into the URL's host: pg would treat "/..." as a unix
// socket directory (local), and on Windows "//server/pipe" or "\\server\pipe"
// is a named pipe that can be on another machine.
const ENCODED_SLASH = /%2f|%5c/i

const MIKRO_ORM_VAR = /^MIKRO_ORM_/i

// A MIKRO_ORM_ name as dotenv reads keys ([\w.-]), to find every one on a line.
const MIKRO_ORM_TOKEN = /MIKRO_ORM_[\w.-]*/gi

// Log colours only (@mikro-orm/core/logging/colors.js:8-10). MikroORM writes
// MIKRO_ORM_COLORS into process.env itself each time it builds a Configuration
// (utils/Configuration.js:357), so a config loaded again in the same process
// (db:migrate, before its migration scripts) would otherwise refuse to load.
// Exact names only.
const MIKRO_ORM_COSMETIC = new Set(["MIKRO_ORM_COLORS", "MIKRO_ORM_NO_COLOR"])

// Every line terminator a regex ^ honours, for line numbers in messages. Built
// from a string, so the source holds no raw line separator characters.
const LINE_BREAK = new RegExp("\\r\\n|[\\n\\r\\u2028\\u2029]")

// The commands that build their own pg.Client and ignore driver options.
const DB_CREATE_COMMAND = /^db:(create|setup)$/i

const DB_CREATE_REFUSAL =
  "medusa db:create/db:setup refuse a remote database; the database already exists"

// pg applies these from the URL over the ssl block in driverOptions, so any of
// them could weaken or disable certificate checks (sslmode=no-verify,
// ssl=false, sslrootcert=...).
const TLS_PARAM = /^(ssl.*|uselibpqcompat)$/i

// pg connects to ?host= / ?hostaddr=; MikroORM ignores them and uses the URL's
// own host.
const HOST_PARAM = /^(host|hostaddr)$/i

const POSTGRES_URL = /^postgres(ql)?:\/\//i

// Set by Medusa's loadDatabaseConfig as a module's URL when DATABASE_URL is not.
const OTHER_DATABASE_URL = /^[A-Z0-9_]+_DATABASE_URL$/i

const CA_PEM = "-----BEGIN CERTIFICATE-----"

function invalid(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.INVALID_ARGUMENT, message)
}

// Hides a value taken from the URL if it could carry the password.
function shown(value: string, secrets: string[]): string {
  return secrets.some((s) => s && value.includes(s)) ? "(hidden)" : value
}

function passwordsIn(url: string): string[] {
  const userinfo = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)@/i.exec(url)?.[1]
  const raw = userinfo?.includes(":") ? userinfo.slice(userinfo.indexOf(":") + 1) : ""
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // keep the raw form
  }
  return [...new Set([raw, decoded].filter(Boolean))]
}

// The query's param names, decoded the way the URL parser decodes them
// (?%73slmode= is sslmode). Read before parse(), which would open the files
// named by sslrootcert, sslcert and sslkey.
function queryParamNames(url: string): string[] {
  const start = url.indexOf("?")
  if (start < 0) {
    return []
  }
  const query = url.slice(start + 1).split("#")[0]
  try {
    return [...new URLSearchParams(query).keys()]
  } catch {
    return []
  }
}

function hostIsLocal(host: string): boolean {
  // A unix-socket directory is local by definition (refuseSlashTricks has
  // already refused "//..." and backslashes).
  if (host.startsWith("/")) {
    return true
  }
  return LOCAL_DB_HOSTS.has(host.replace(/^\[|\]$/g, "").toLowerCase())
}

function refuseSlashTricks(host: string, label: string): void {
  if (host.includes("\\") || host.startsWith("//")) {
    throw invalid(
      `${label} must not start with "//" or contain "\\": on Windows that is a named ` +
        "pipe, which can be on another machine. Use a host name, or a plain socket directory."
    )
  }
}

// <cwd>/.env, or null when there is none. Any other read error refuses: the
// guard must see what db:create and MikroORM would read.
function readDotEnv(cwd: string): string | null {
  try {
    return readFileSync(join(cwd, ".env"), "utf8")
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code ?? "unknown error"
    if (code === "ENOENT") {
      return null
    }
    throw invalid(`The project's .env file could not be read (${code})`)
  }
}

/**
 * MikroORM applies MIKRO_ORM_* variables over the options Medusa passes it
 * (host, clientUrl, port, user, ...), for every module's migrations and
 * connections. Refuse them in the environment, and anywhere in <cwd>/.env:
 * MikroORM loads that file itself at init, after this config has loaded. The
 * file check is a plain text search, so no parser difference can hide a key;
 * a comment that mentions one is refused too. The two colour switches are the
 * only exception (MIKRO_ORM_COSMETIC). Names only, never values.
 */
function refuseMikroOrmOverrides(env: NodeJS.ProcessEnv, dotEnv: string | null): void {
  const names = Object.keys(env).filter(
    (k) => MIKRO_ORM_VAR.test(k) && !MIKRO_ORM_COSMETIC.has(k)
  )
  if (names.length) {
    throw invalid(
      `${names.join(", ")} must not be set: MikroORM would apply ${names.length > 1 ? "them" : "it"} ` +
        `over DATABASE_URL and the TLS options. Unset ${names.length > 1 ? "them" : "it"}.`
    )
  }
  if (dotEnv === null) {
    return
  }
  const lines = dotEnv
    .split(LINE_BREAK)
    .map((line, i) =>
      (line.match(MIKRO_ORM_TOKEN) ?? []).some((token) => !MIKRO_ORM_COSMETIC.has(token))
        ? i + 1
        : 0
    )
    .filter(Boolean)
  if (lines.length) {
    throw invalid(
      `The project's .env file mentions MIKRO_ORM_ (line ${lines.join(", ")}): MikroORM ` +
        "loads MIKRO_ORM_* keys from it and applies them over DATABASE_URL. Remove them."
    )
  }
}

// The DATABASE_URL `medusa db:create` reads: the first line of <cwd>/.env that
// starts with "DATABASE_URL=", everything after the first "=", unquoted and
// untrimmed (EnvEditor.get, @medusajs/utils/dist/common/env-editor.js:38-49).
function dbCreateUrl(dotEnv: string | null): string | null {
  const line = dotEnv?.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))
  return line === undefined ? null : line.slice("DATABASE_URL=".length)
}

/**
 * `medusa db:create` and `db:setup` connect with their own pg.Client, built
 * from the URL alone: no driver options, so no verified TLS. Both run only
 * against a local server; the production database already exists. Checks the
 * URL this config sees and the one db:create reads from .env (dotenv never
 * overrides a variable that is already set, so they can differ).
 */
function refuseRemoteDbCreate(
  env: NodeJS.ProcessEnv,
  configured: { host: string; secrets: string[] },
  dotEnv: string | null
): void {
  if (!hostIsLocal(configured.host)) {
    throw invalid(`${DB_CREATE_REFUSAL} (${shown(configured.host, configured.secrets)}).`)
  }
  const fileUrl = dbCreateUrl(dotEnv)
  if (fileUrl === null) {
    // db:create stops by itself: "Missing DATABASE_URL inside the .env file".
    return
  }
  let fromFile: { host: string; secrets: string[] }
  try {
    fromFile = databaseHost({ ...env, DATABASE_URL: fileUrl })
  } catch (e) {
    throw invalid(
      `${DB_CREATE_REFUSAL}: the DATABASE_URL in .env, which they read, is refused: ` +
        (e as Error).message
    )
  }
  if (!hostIsLocal(fromFile.host)) {
    throw invalid(
      `${DB_CREATE_REFUSAL} (${shown(fromFile.host, fromFile.secrets)}, from DATABASE_URL in .env).`
    )
  }
}

function refuseMultiHost(host: string, label: string): void {
  if (host.includes(",")) {
    throw invalid(
      `${label} must name exactly one host: multi-host connection strings are not supported.`
    )
  }
}

/**
 * The single host every connection will use: the URL's own host, or PGHOST
 * (then localhost, pg's default) when that is empty or DATABASE_URL is unset.
 * Throws for anything that would let the server and migrations differ.
 */
function databaseHost(env: NodeJS.ProcessEnv): { host: string; secrets: string[] } {
  const url = env.DATABASE_URL
  const pgHost = () => {
    const fallback = env.PGHOST || "localhost"
    refuseMultiHost(fallback, "PGHOST")
    refuseSlashTricks(fallback, "PGHOST")
    return fallback
  }

  if (!url) {
    const others = Object.keys(env).filter((k) => OTHER_DATABASE_URL.test(k) && env[k])
    if (others.length) {
      throw invalid(
        `DATABASE_URL is not set but ${others.join(", ")} is: Medusa would connect ` +
          "with it unchecked. Set DATABASE_URL instead."
      )
    }
    return { host: pgHost(), secrets: [] }
  }

  const secrets = passwordsIn(url)
  if (!POSTGRES_URL.test(url.trim())) {
    throw invalid("DATABASE_URL must be a postgres:// or postgresql:// connection string")
  }

  const params = [...new Set(queryParamNames(url))]
  const tlsParams = params.filter((name) => TLS_PARAM.test(name))
  if (tlsParams.length) {
    throw invalid(
      `DATABASE_URL must not set TLS options (${shown(tlsParams.join(", "), secrets)}): ` +
        "they override DB_SSL and DB_CA_PATH. Remove them and set DB_SSL=true with DB_CA_PATH."
    )
  }
  const hostParams = params.filter((name) => HOST_PARAM.test(name))
  if (hostParams.length) {
    throw invalid(
      `DATABASE_URL must not set ${shown(hostParams.join(", "), secrets)} as a query ` +
        "param: pg would connect there, but migrations (MikroORM) use the URL's own " +
        "host. Put the host in the URL itself."
    )
  }
  const connectionParams = params.filter((name) => CONNECTION_PARAM.test(name))
  if (connectionParams.length) {
    throw invalid(
      `DATABASE_URL must not set ${shown(connectionParams.join(", "), secrets)} as a query ` +
        "param: pg would use it, but migrations (MikroORM) read only the URL's own parts. " +
        "Put it in the URL itself."
    )
  }

  // The authority's host part, before any parser: "h1,h2" or "h1:5432,h2:5432".
  const authority = /^[a-z]+:\/\/([^/?#]*)/i.exec(url.trim())?.[1] ?? ""
  const rawHost = authority.slice(authority.lastIndexOf("@") + 1)
  refuseMultiHost(rawHost, "DATABASE_URL")
  if (ENCODED_SLASH.test(rawHost)) {
    throw invalid(
      'DATABASE_URL must not percent-encode "/" or "\\" in its host. For a unix socket, ' +
        "leave the URL's host empty (postgres:///db) and set PGHOST to the socket directory."
    )
  }

  let migrationHost: string
  let serverHost: string
  try {
    // Exactly what MikroORM's Connection.getConnectionOptions() does.
    migrationHost = decodeURIComponent(new URL(url).hostname)
    const parsed = parse(url) as unknown as Record<string, unknown>
    serverHost = typeof parsed.host === "string" ? parsed.host : ""
  } catch {
    throw invalid(
      "DATABASE_URL is not a valid connection string (migrations read it with new URL())"
    )
  }
  if (migrationHost.toLowerCase() !== serverHost.toLowerCase()) {
    throw invalid(
      "DATABASE_URL is ambiguous: the server (pg) and migrations (MikroORM) would " +
        "connect to different hosts."
    )
  }
  refuseMultiHost(migrationHost, "DATABASE_URL")
  refuseSlashTricks(migrationHost, "The DATABASE_URL host")
  return { host: migrationHost || pgHost(), secrets }
}

function readCa(env: NodeJS.ProcessEnv): string {
  const path = env.DB_CA_PATH
  if (!path) {
    throw invalid("DB_SSL=true requires DB_CA_PATH to point at the database CA certificate")
  }
  let ca: string
  try {
    ca = readFileSync(path, "utf8")
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code ?? "unknown error"
    throw invalid(`DB_CA_PATH could not be read (${code})`)
  }
  if (!ca.includes(CA_PEM)) {
    throw invalid("DB_CA_PATH does not hold a PEM certificate (-----BEGIN CERTIFICATE-----)")
  }
  return ca
}

/**
 * The databaseDriverOptions medusa-config passes to Medusa, always explicit:
 * - DB_SSL=true: verified TLS, `{ rejectUnauthorized: true, ca }` from
 *   DB_CA_PATH (required, must be readable);
 * - otherwise the database must be local: `{ ssl: false }`.
 * Throws (at config load, before any connection) for everything else,
 * including any MIKRO_ORM_* override and `medusa db:create` / `db:setup`
 * against a remote host.
 */
export function databaseDriverOptions(
  env: NodeJS.ProcessEnv = process.env,
  { argv = process.argv, cwd = process.cwd() }: DatabaseGuardOptions = {}
): DatabaseDriverOptions {
  const dotEnv = readDotEnv(cwd)
  refuseMikroOrmOverrides(env, dotEnv)
  const configured = databaseHost(env)
  if (argv.some((arg) => DB_CREATE_COMMAND.test(arg))) {
    refuseRemoteDbCreate(env, configured, dotEnv)
  }
  const { host, secrets } = configured
  if (!hostIsLocal(host) && env.DB_SSL !== "true") {
    throw invalid(
      `The database is on a remote host (${shown(host, secrets)}) but DB_SSL is not ` +
        '"true". Set DB_SSL=true and DB_CA_PATH so the certificate is verified.'
    )
  }
  if (env.DB_SSL === "true") {
    return { connection: { ssl: { rejectUnauthorized: true, ca: readCa(env) } } }
  }
  return { connection: { ssl: false } }
}
