import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parse } from "pg-connection-string"
import { databaseDriverOptions } from "../database-tls"

const PASSWORD = "hunter2-Secret"
const REMOTE = "db.example.supabase.co"
const FAKE_PEM = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n"

let dir: string
let caPath: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "db-tls-"))
  caPath = join(dir, "ca.pem")
  writeFileSync(caPath, FAKE_PEM)
  writeFileSync(join(dir, "not-a-cert.txt"), "hello")
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

// What pg's ConnectionParameters does with our config: the URL's own params
// are applied last, so they override host and ssl from medusa-config.
const effective = (url: string, sslFromConfig: unknown) =>
  Object.assign({}, { ssl: sslFromConfig }, parse(url))

type GuardOptions = Parameters<typeof databaseDriverOptions>[1]

function messageOf(env: NodeJS.ProcessEnv, options?: GuardOptions): string {
  try {
    databaseDriverOptions(env, options)
  } catch (e) {
    return (e as Error).message
  }
  throw new Error("expected databaseDriverOptions to throw")
}

// Every refusal names what is wrong and never the password.
function expectRefused(env: NodeJS.ProcessEnv, pattern: RegExp, options?: GuardOptions) {
  const message = messageOf(env, options)
  expect(message).toMatch(pattern)
  expect(message).not.toContain(PASSWORD)
  expect(message).not.toContain(encodeURIComponent(PASSWORD))
  return message
}

const LOCAL_ONLY = { connection: { ssl: false } }

describe("databaseDriverOptions: local databases", () => {
  it.each([
    `postgres://postgres:${PASSWORD}@localhost:5432/medusa-backend`,
    `postgres://postgres:${PASSWORD}@LOCALHOST/medusa-backend`,
    `postgres://postgres:${PASSWORD}@127.0.0.1:5432/medusa-backend`,
    `postgresql://postgres:${PASSWORD}@[::1]:5432/medusa-backend`,
    `postgresql://postgres:${PASSWORD}@[0:0:0:0:0:0:0:1]:5432/medusa-backend`,
    `postgres://postgres:${PASSWORD}@local%68ost/medusa-backend`,
    `postgres://postgres:${PASSWORD}@localhost/medusa?application_name=medusa&connect_timeout=10`,
  ])("is { ssl: false } without DB_SSL: %s", (url) => {
    expect(databaseDriverOptions({ DATABASE_URL: url })).toStrictEqual(LOCAL_ONLY)
  })

  it("is verified TLS when DB_SSL=true, even for a local host", () => {
    expect(
      databaseDriverOptions({
        DATABASE_URL: "postgres://u:pw@localhost/db",
        DB_SSL: "true",
        DB_CA_PATH: caPath,
      })
    ).toStrictEqual({ connection: { ssl: { rejectUnauthorized: true, ca: FAKE_PEM } } })
  })
})

describe("databaseDriverOptions: remote databases", () => {
  const url = `postgres://user:${PASSWORD}@${REMOTE}:5432/postgres`

  it.each([undefined, "false", "1", "TRUE", "yes"])("refuses DB_SSL=%p", (dbSsl) => {
    const message = expectRefused({ DATABASE_URL: url, DB_SSL: dbSsl }, /DB_SSL/)
    expect(message).toContain(REMOTE)
  })

  it("is { rejectUnauthorized: true, ca } with DB_SSL=true and a readable CA", () => {
    expect(
      databaseDriverOptions({ DATABASE_URL: url, DB_SSL: "true", DB_CA_PATH: caPath })
    ).toStrictEqual({ connection: { ssl: { rejectUnauthorized: true, ca: FAKE_PEM } } })
  })

  it("refuses DB_SSL=true without DB_CA_PATH", () => {
    expectRefused({ DATABASE_URL: url, DB_SSL: "true" }, /DB_CA_PATH/)
  })

  it.each([
    ["a missing file", () => join(dir, "missing.pem")],
    ["a directory", () => dir],
    ["a file that holds no PEM certificate", () => join(dir, "not-a-cert.txt")],
  ])("refuses a DB_CA_PATH that is %s", (_label, path) => {
    expectRefused({ DATABASE_URL: url, DB_SSL: "true", DB_CA_PATH: path() }, /DB_CA_PATH/)
  })

  // Medusa's default (loadDatabaseConfig) picks ssl: false whenever
  // "localhost" appears anywhere in the URL. Our options are always explicit.
  it.each([
    `postgres://localhost:${PASSWORD}@${REMOTE}/postgres`,
    `postgres://user:${PASSWORD}@${REMOTE}/localhost_db`,
    `postgres://user:${PASSWORD}@${REMOTE}/db?application_name=localhost`,
  ])("is not fooled by \"localhost\" elsewhere in the URL: %s", (remote) => {
    expectRefused({ DATABASE_URL: remote }, /DB_SSL/)
  })

  it.each([
    "127.0.0.2",
    "[::2]",
    "[2001:db8::1]",
    "localhost.example.com",
    "10.0.0.5",
  ])("treats %s as remote", (host) => {
    expectRefused({ DATABASE_URL: `postgres://u:${PASSWORD}@${host}:5432/db` }, /DB_SSL/)
  })
})

// Re-check fix, bug 2. pg (the server's knex pool) honours ?host=, but
// `medusa db:migrate` connects through MikroORM, which reads the URL's own
// hostname (new URL(clientUrl).hostname) and ignores the query. The guard
// checked pg's host only, so this URL passed and migrations then connected to
// nonexistent-db.invalid with Medusa's localhost heuristic (ssl: false).
describe("host and hostaddr params", () => {
  it("reproduction: refuses ?host=localhost on a remote URL", () => {
    const url = `postgres://u:${PASSWORD}@nonexistent-db.invalid:5432/db?host=localhost`
    expect(effective(url, undefined).host).toBe("localhost")
    expect(new URL(url).hostname).toBe("nonexistent-db.invalid")
    expectRefused({ DATABASE_URL: url }, /host/)
  })

  it.each([
    "host=localhost",
    "host=db.remote.example.com",
    "host=/var/run/postgresql",
    "%68ost=localhost",
    "HOST=localhost",
    "hostaddr=127.0.0.1",
    "hostaddr=10.0.0.1",
    "Hostaddr=10.0.0.1",
  ])("refuses ?%s on any URL, even with DB_SSL=true", (param) => {
    for (const host of ["localhost", REMOTE]) {
      const url = `postgres://u:${PASSWORD}@${host}:5432/db?application_name=x&${param}`
      expectRefused({ DATABASE_URL: url, DB_SSL: "true", DB_CA_PATH: caPath }, /host/)
    }
  })
})

describe("multi-host URLs", () => {
  it.each([
    `postgres://u:${PASSWORD}@localhost,${REMOTE}/db`,
    `postgres://u:${PASSWORD}@${REMOTE},localhost/db`,
    `postgres://u:${PASSWORD}@localhost:5432,${REMOTE}:5432/db`,
  ])("refuses %s, even with DB_SSL=true", (url) => {
    expectRefused(
      { DATABASE_URL: url, DB_SSL: "true", DB_CA_PATH: caPath },
      /one host|DATABASE_URL/
    )
  })

  it("refuses a multi-host PGHOST used for an empty URL host", () => {
    expectRefused(
      { DATABASE_URL: "postgres:///db", PGHOST: `localhost,${REMOTE}`, DB_SSL: "true", DB_CA_PATH: caPath },
      /one host/
    )
  })
})

// An empty host means pg (server) and MikroORM (migrations) both fall back to
// PGHOST, then localhost.
describe("empty host", () => {
  const url = "postgres:///medusa"

  it.each([undefined, "", "localhost", "127.0.0.1", "::1", "/var/run/postgresql"])(
    "is local with PGHOST=%p",
    (pghost) => {
      expect(databaseDriverOptions({ DATABASE_URL: url, PGHOST: pghost })).toStrictEqual(LOCAL_ONLY)
    }
  )

  it("is remote with a remote PGHOST", () => {
    const message = expectRefused({ DATABASE_URL: url, PGHOST: REMOTE }, /DB_SSL/)
    expect(message).toContain(REMOTE)
    expect(
      databaseDriverOptions({ DATABASE_URL: url, PGHOST: REMOTE, DB_SSL: "true", DB_CA_PATH: caPath })
    ).toStrictEqual({ connection: { ssl: { rejectUnauthorized: true, ca: FAKE_PEM } } })
  })

  it("refuses credentials with an empty host (MikroORM's new URL() cannot read it)", () => {
    expectRefused({ DATABASE_URL: `postgres://u:${PASSWORD}@/db` }, /DATABASE_URL/)
  })
})

describe("DATABASE_URL not set", () => {
  it("follows PGHOST, as pg does", () => {
    expect(databaseDriverOptions({})).toStrictEqual(LOCAL_ONLY)
    expect(databaseDriverOptions({ PGHOST: "localhost" })).toStrictEqual(LOCAL_ONLY)
    expectRefused({ PGHOST: REMOTE }, /DB_SSL/)
  })

  // Medusa's modules then read their URL from these instead (loadDatabaseConfig).
  it.each(["MEDUSA_DATABASE_URL", "PRODUCT_DATABASE_URL"])("refuses %s", (name) => {
    expectRefused({ [name]: `postgres://u:${PASSWORD}@${REMOTE}/db` }, new RegExp(name))
  })
})

describe("unusable URLs", () => {
  it.each([
    `not a url ${PASSWORD}`,
    `mysql://user:${PASSWORD}@localhost/db`,
    `postgres://user:${PASSWORD}@local host:5432/db%zz`,
    // pg reads these as unix sockets, but MikroORM (migrations) cannot parse them.
    `socket://u:${PASSWORD}@/var/run/postgresql?db=medusa`,
    "/var/run/postgresql medusa",
  ])("refuses %s without echoing it", (url) => {
    expectRefused({ DATABASE_URL: url }, /DATABASE_URL/)
  })
})

// pg applies TLS params from the URL over the ssl block in driverOptions, so
// they could silently turn verification off.
describe("TLS settings in the URL", () => {
  it("would let ?sslmode= override the configured CA (why they are refused)", () => {
    const configured = { rejectUnauthorized: true, ca: "PEM" }
    const url = "postgres://u:pw@db.remote.example.com:5432/db?sslmode=no-verify"
    expect(effective(url, configured).ssl).not.toEqual(configured)
  })

  it.each([
    "sslmode=no-verify",
    "sslmode=disable",
    "sslmode=require",
    "sslmode=verify-full",
    "ssl=false",
    "ssl=true",
    "SSL=0",
    "sslrootcert=/does/not/exist.pem",
    "sslcert=/does/not/exist.pem",
    "sslkey=/does/not/exist.pem",
    "sslnegotiation=direct",
    "uselibpqcompat=true",
    "%73slmode=disable",
  ])("refuses ?%s even with DB_SSL=true", (param) => {
    for (const host of [REMOTE, "localhost"]) {
      const url = `postgres://u:${PASSWORD}@${host}:5432/db?application_name=x&${param}`
      const message = expectRefused({ DATABASE_URL: url, DB_SSL: "true", DB_CA_PATH: caPath }, /TLS/)
      expect(message).not.toContain("/does/not/exist.pem")
    }
  })
})

describe("error messages", () => {
  it("name the host but never the password, even an encoded one", () => {
    const encoded = encodeURIComponent("p@ss/w:rd?#")
    const message = messageOf({ DATABASE_URL: `postgres://user:${encoded}@db.example.com/postgres` })
    expect(message).toContain("db.example.com")
    expect(message).not.toContain(encoded)
    expect(message).not.toContain("p@ss/w:rd?#")
  })
})

// ---------------------------------------------------------------------------
// M2 B2: the side paths left open by the M0 final verification.
// ---------------------------------------------------------------------------

// argv as the medusa CLI sees it (yargs reads the command from argv[2]).
const cli = (...args: string[]) => [
  "/usr/bin/node",
  "/app/node_modules/@medusajs/cli/cli.js",
  ...args,
]

// A directory standing in for the project root (process.cwd()), optionally
// with a .env file: `medusa db:create` reads DATABASE_URL from <cwd>/.env
// itself, and MikroORM loads MIKRO_ORM_* keys from <cwd>/.env at init.
function projectDir(dotEnv?: string): string {
  const root = mkdtempSync(join(dir, "project-"))
  if (dotEnv !== undefined) {
    writeFileSync(join(root, ".env"), dotEnv)
  }
  return root
}

const LOCAL_URL = `postgres://postgres:${PASSWORD}@localhost:5432/medusa-backend`
const REMOTE_URL = `postgres://postgres.ref:${PASSWORD}@${REMOTE}:5432/postgres`
const VERIFIED = { connection: { ssl: { rejectUnauthorized: true, ca: FAKE_PEM } } }

// `medusa db:create` and `db:setup` open their own pg.Client from the URL with
// no driver options (@medusajs/medusa/dist/commands/db/create.js:67-97), so
// they would connect to a remote host without verified TLS. They load
// medusa-config first (initializeContainer, skipDbConnection), so a throw
// there stops them before any connection.
describe("B2 rule 1: db:create and db:setup refuse a remote database", () => {
  it.each(["db:create", "db:setup", "DB:CREATE", "Db:Setup"])(
    "refuses %s with a remote DATABASE_URL, even with DB_SSL=true and a CA",
    (command) => {
      const message = expectRefused(
        { DATABASE_URL: REMOTE_URL, DB_SSL: "true", DB_CA_PATH: caPath },
        /medusa db:create\/db:setup refuse a remote database; the database already exists/,
        { argv: cli(command, "--no-interactive"), cwd: projectDir() }
      )
      expect(message).toContain(REMOTE)
    }
  )

  it("refuses a remote PGHOST behind an empty URL host", () => {
    expectRefused(
      { DATABASE_URL: "postgres:///medusa", PGHOST: REMOTE, DB_SSL: "true", DB_CA_PATH: caPath },
      /refuse a remote database/,
      { argv: cli("db:create"), cwd: projectDir() }
    )
  })

  // db:create reads DATABASE_URL from <cwd>/.env with EnvEditor, not from
  // process.env (create.js:32-41), and dotenv never overrides a variable that
  // is already set. So a local process.env URL does not prove the target.
  it("refuses when the .env file db:create reads names a remote host", () => {
    expectRefused({ DATABASE_URL: LOCAL_URL }, /refuse a remote database/, {
      argv: cli("db:create"),
      cwd: projectDir(`DB_NAME=x\nDATABASE_URL=${REMOTE_URL}\n`),
    })
  })

  it.each([
    ["?host=", `DATABASE_URL=postgres://u:${PASSWORD}@localhost/db?host=${REMOTE}`],
    ["a quoted value", `DATABASE_URL="${LOCAL_URL}"`],
    ["sslmode", `DATABASE_URL=${LOCAL_URL}?sslmode=disable`],
    ["an unreadable URL", `DATABASE_URL=not a url ${PASSWORD}`],
  ])("refuses a .env DATABASE_URL with %s, without printing the password", (_label, line) => {
    expectRefused({ DATABASE_URL: LOCAL_URL }, /\.env/, {
      argv: cli("db:setup"),
      cwd: projectDir(`${line}\n`),
    })
  })

  it("allows db:create and db:setup when both URLs are local", () => {
    for (const command of ["db:create", "db:setup"]) {
      expect(
        databaseDriverOptions(
          { DATABASE_URL: LOCAL_URL },
          {
            argv: cli(command, "--db", "medusa_new"),
            cwd: projectDir(`DATABASE_URL=${LOCAL_URL}\r\n`),
          }
        )
      ).toStrictEqual(LOCAL_ONLY)
    }
  })

  it("allows db:create when .env is missing or has no DATABASE_URL (db:create stops itself)", () => {
    for (const cwd of [projectDir(), projectDir("DB_NAME=x\n")]) {
      expect(
        databaseDriverOptions({ DATABASE_URL: LOCAL_URL }, { argv: cli("db:create"), cwd })
      ).toStrictEqual(LOCAL_ONLY)
    }
  })

  it.each(["db:migrate", "start", "exec", "db:rollback", "db:sync-links", "user", "develop", "build"])(
    "allows %s with a remote host and DB_SSL=true",
    (command) => {
      expect(
        databaseDriverOptions(
          { DATABASE_URL: REMOTE_URL, DB_SSL: "true", DB_CA_PATH: caPath },
          { argv: cli(command), cwd: projectDir(`DATABASE_URL=${REMOTE_URL}\n`) }
        )
      ).toStrictEqual(VERIFIED)
    }
  )
})

// MikroORM 6.6.14 merges MIKRO_ORM_* environment variables over the options
// Medusa passes (MikroORM.init: loadEnvironmentVars + Utils.mergeConfig), so
// MIKRO_ORM_HOST or MIKRO_ORM_CLIENT_URL would move migrations to another
// host. registerDotenv also copies MIKRO_ORM_* keys from <cwd>/.env into
// process.env at init, after medusa-config has loaded.
describe("B2 rule 2: MIKRO_ORM_* variables", () => {
  it.each([
    "MIKRO_ORM_HOST",
    "MIKRO_ORM_CLIENT_URL",
    "MIKRO_ORM_PORT",
    "MIKRO_ORM_ENV",
    "MIKRO_ORM_DEBUG",
    "mikro_orm_host",
    "Mikro_Orm_Client_Url",
  ])("refuses %s, naming it but not its value", (name) => {
    const value = `postgres://u:${PASSWORD}@evil.example.com/db`
    const message = expectRefused(
      { DATABASE_URL: LOCAL_URL, [name]: value },
      new RegExp(name),
      { argv: cli("db:migrate"), cwd: projectDir() }
    )
    expect(message).not.toContain("evil.example.com")
  })

  it("refuses an empty MIKRO_ORM_HOST (MikroORM reads any key that is present)", () => {
    expectRefused({ DATABASE_URL: LOCAL_URL, MIKRO_ORM_HOST: "" }, /MIKRO_ORM_HOST/, {
      argv: cli("start"),
      cwd: projectDir(),
    })
  })

  it.each([
    "MIKRO_ORM_HOST=evil.example.com",
    "export MIKRO_ORM_CLIENT_URL=postgres://evil.example.com/db",
    "   mikro_orm_host = evil.example.com",
    "MIKRO_ORM_HOST: evil.example.com",
    "# MIKRO_ORM_HOST=evil.example.com",
    "OTHER=1\rMIKRO_ORM_PORT=6000",
  ])("refuses a <cwd>/.env holding %p, without printing the value", (line) => {
    const message = expectRefused({ DATABASE_URL: LOCAL_URL }, /MIKRO_ORM_/i, {
      argv: cli("db:migrate"),
      cwd: projectDir(`DATABASE_URL=${LOCAL_URL}\n${line}\n`),
    })
    expect(message).not.toContain("evil.example.com")
    expect(message).not.toContain("6000")
  })

  it("allows a .env without MIKRO_ORM_ keys, and no .env at all", () => {
    for (const cwd of [
      projectDir(`DATABASE_URL=${LOCAL_URL}\nMIKRO=1\nORM_HOST=x\n`),
      projectDir(),
    ]) {
      expect(
        databaseDriverOptions({ DATABASE_URL: LOCAL_URL }, { argv: cli("start"), cwd })
      ).toStrictEqual(LOCAL_ONLY)
    }
  })
})

// pg-connection-string copies every query param into pg's config, so ?port=,
// ?user= and ?password= win over the URL's own parts; MikroORM (migrations)
// reads only the URL's own parts. ?database= and ?dbname= are ignored by
// pg-connection-string 2.14 (the path wins), and are refused all the same.
describe("B2 rule 3: connection params in the query", () => {
  it("would let ?port= send pg somewhere MikroORM does not go (why they are refused)", () => {
    const url = `postgres://u:pw@${REMOTE}:5432/db?port=6543`
    expect(parse(url).port).toBe("6543")
    expect(new URL(url).port).toBe("5432")
  })

  it.each([
    "port=6543",
    "user=other",
    "password=other",
    "database=other",
    "dbname=other",
    "PORT=6543",
    "User=other",
    "PassWord=other",
    "DataBase=other",
    "DBNAME=other",
    "%70ort=6543",
    "pass%77ord=other",
    "%64bname=other",
  ])("refuses ?%s on a local or remote URL, even with DB_SSL=true", (param) => {
    for (const host of ["localhost", REMOTE]) {
      const url = `postgres://u:${PASSWORD}@${host}:5432/db?application_name=x&${param}`
      expectRefused(
        { DATABASE_URL: url, DB_SSL: "true", DB_CA_PATH: caPath },
        /port|user|password|database|dbname/i,
        { argv: cli("start"), cwd: projectDir() }
      )
    }
  })

  it("still allows harmless params", () => {
    const url = `${LOCAL_URL}?application_name=medusa&connect_timeout=10&options=-c%20statement_timeout%3D0`
    expect(
      databaseDriverOptions({ DATABASE_URL: url }, { argv: cli("start"), cwd: projectDir() })
    ).toStrictEqual(LOCAL_ONLY)
  })
})

// A host starting with "/" is a unix-socket directory for pg, so it counts as
// local. On Windows, "//server/pipe/..." or a backslash path is a named pipe
// that can sit on another machine, so slashes may not be smuggled into the
// URL's host, and a socket path must be a plain absolute path.
describe("B2 rule 4: slashes in the host", () => {
  it.each([
    "%2Fvar%2Frun%2Fpostgresql",
    "%2fvar%2frun%2fpostgresql",
    "%5C%5Cserver%5Cpipe",
    "%5cserver%5cpipe",
    "local%2Fhost",
    "localhost%2F",
    "%2F%2Fserver%2Fpipe",
  ])("refuses the URL host %s, even with DB_SSL=true", (host) => {
    for (const env of [{}, { DB_SSL: "true", DB_CA_PATH: caPath }]) {
      expectRefused(
        { DATABASE_URL: `postgres://u:${PASSWORD}@${host}:5432/db`, ...env },
        /host/i,
        { argv: cli("start"), cwd: projectDir() }
      )
    }
  })

  it.each(["//server/pipe/postgres", "\\\\server\\pipe", "/var/run\\postgresql", "\\var\\run"])(
    "refuses PGHOST %s behind an empty URL host",
    (pghost) => {
      expectRefused({ DATABASE_URL: "postgres:///db", PGHOST: pghost }, /host/i, {
        argv: cli("start"),
        cwd: projectDir(),
      })
    }
  )

  it("still treats a plain socket directory in PGHOST as local", () => {
    expect(
      databaseDriverOptions(
        { DATABASE_URL: "postgres:///db", PGHOST: "/var/run/postgresql" },
        { argv: cli("start"), cwd: projectDir() }
      )
    ).toStrictEqual(LOCAL_ONLY)
  })
})

// Found by the manual `medusa db:migrate` check: MikroORM writes
// process.env.MIKRO_ORM_COLORS itself whenever it builds a Configuration
// (@mikro-orm/core/utils/Configuration.js:357, sync()), so medusa-config,
// loaded again later in the same process (db:migrate before its migration
// scripts), must not refuse it. It and MIKRO_ORM_NO_COLOR only switch log
// colours (logging/colors.js:8-10).
describe("B2 rule 2: MikroORM's own colour switches", () => {
  it.each([
    ["MIKRO_ORM_COLORS", "true"],
    ["MIKRO_ORM_COLORS", "false"],
    ["MIKRO_ORM_NO_COLOR", "1"],
  ])("allows %s=%s in the environment", (name, value) => {
    expect(
      databaseDriverOptions(
        { DATABASE_URL: LOCAL_URL, [name]: value },
        { argv: cli("db:migrate"), cwd: projectDir() }
      )
    ).toStrictEqual(LOCAL_ONLY)
  })

  it("allows them in .env too", () => {
    expect(
      databaseDriverOptions(
        { DATABASE_URL: LOCAL_URL },
        { argv: cli("start"), cwd: projectDir("MIKRO_ORM_COLORS=false\nMIKRO_ORM_NO_COLOR=1\n") }
      )
    ).toStrictEqual(LOCAL_ONLY)
  })

  it.each(["mikro_orm_colors", "MIKRO_ORM_COLORSX", "MIKRO_ORM_COLORS_HOST"])(
    "still refuses the near miss %s in the environment",
    (name) => {
      expectRefused({ DATABASE_URL: LOCAL_URL, [name]: "true" }, new RegExp(name), {
        argv: cli("start"),
        cwd: projectDir(),
      })
    }
  )

  it.each([
    "MIKRO_ORM_COLORS=1 MIKRO_ORM_HOST=evil.example.com",
    "MIKRO_ORM_COLORS.x=1",
    "MIKRO_ORM_COLORS-HOST=1",
    "mikro_orm_colors=1",
  ])("still refuses a .env line %p", (line) => {
    expectRefused({ DATABASE_URL: LOCAL_URL }, /MIKRO_ORM_/i, {
      argv: cli("start"),
      cwd: projectDir(`${line}\n`),
    })
  })
})
