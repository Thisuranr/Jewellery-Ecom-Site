#!/usr/bin/env node
// Static check for the Cloudflare rule expressions in rules.md (plan M2, task I5).
//
//   node infra/cloudflare/lint-rules.mjs
//
// It reads every ```cf-expr rule=<name> block in rules.md and:
//   1. fills in the placeholders (<domain>, <droplet IPv4>, <droplet IPv6>),
//   2. parses the expression with a small parser for the subset of Cloudflare's
//      Rules language used here (fields, starts_with/lower, eq/ne/contains/in,
//      not/and/or, inline sets of IPs) and rejects anything outside it,
//   3. replays test requests against each rule and compares with the expected
//      verdict (match / no match), including the URL normalization Cloudflare
//      applies before rules run (percent-decoding of unreserved characters,
//      merged slashes, dot segments).
//
// This is NOT Cloudflare's own validator (that needs an account and an API
// token). It catches typos, unbalanced brackets, uppercase operators, regex use
// (not allowed on the Free plan) and logic mistakes. The dashboard's expression
// editor remains the final syntax check. No dependencies; Node 22 or newer.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const RULES_MD = join(dirname(fileURLToPath(import.meta.url)), "rules.md")

const PLACEHOLDERS = {
  "<domain>": "example.com.au",
  "<droplet IPv4>": "203.0.113.10",
  "<droplet IPv6>": "2001:db8:0:1::10",
}
const FIELDS = new Set(["http.host", "http.request.uri.path", "ip.src"])
const FUNCTIONS = { starts_with: 2, lower: 1 }
const OPERATORS = new Set(["eq", "ne", "contains", "in"])
const LOGIC = new Set(["and", "or", "not"])
const MAX_EXPRESSION_LENGTH = 4096 // Cloudflare's documented limit per expression

// ---------------------------------------------------------------- tokenizer

function tokenize(src) {
  const tokens = []
  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)
    let m
    if (/^\s/.test(rest)) {
      i += 1
    } else if (rest[0] === '"') {
      let j = 1
      let value = ""
      while (j < rest.length && rest[j] !== '"') {
        if (rest[j] === "\\") {
          if (rest[j + 1] !== '"' && rest[j + 1] !== "\\") throw new Error(`bad escape at ${i + j}`)
          value += rest[j + 1]
          j += 2
        } else {
          value += rest[j]
          j += 1
        }
      }
      if (rest[j] !== '"') throw new Error(`unterminated string at ${i}`)
      tokens.push({ t: "str", v: value })
      i += j + 1
    } else if ("(){},".includes(rest[0])) {
      tokens.push({ t: rest[0] })
      i += 1
    } else if ((m = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F]*:[0-9a-fA-F:.]*)(?:\/\d{1,3})?/.exec(rest))) {
      tokens.push({ t: "ip", v: m[0] })
      i += m[0].length
    } else if ((m = /^\d+/.exec(rest))) {
      tokens.push({ t: "num", v: Number(m[0]) })
      i += m[0].length
    } else if ((m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest))) {
      tokens.push({ t: "id", v: m[0] })
      i += m[0].length
    } else {
      throw new Error(`unexpected character "${rest[0]}" at ${i}`)
    }
  }
  return tokens
}

// ------------------------------------------------------------------- parser

function parse(src) {
  const tokens = tokenize(src)
  let p = 0
  const peek = () => tokens[p]
  const isId = (v) => peek()?.t === "id" && peek().v === v
  const expect = (t) => {
    if (peek()?.t !== t) throw new Error(`expected "${t}" but found ${JSON.stringify(peek() ?? "end of input")}`)
    return tokens[p++]
  }

  function parseOr() {
    let left = parseAnd()
    while (isId("or")) {
      p++
      left = { k: "or", l: left, r: parseAnd() }
    }
    return left
  }
  function parseAnd() {
    let left = parseNot()
    while (isId("and")) {
      p++
      left = { k: "and", l: left, r: parseNot() }
    }
    return left
  }
  function parseNot() {
    if (isId("not")) {
      p++
      return { k: "not", e: parseNot() }
    }
    return parsePrimary()
  }
  function parsePrimary() {
    if (peek()?.t === "(") {
      p++
      const e = parseOr()
      expect(")")
      return e
    }
    const left = parseValue()
    const op = peek()
    if (op?.t === "id" && OPERATORS.has(op.v)) {
      p++
      const right = op.v === "in" ? parseSet() : parseValue()
      return { k: "cmp", op: op.v, l: left, r: right }
    }
    if (left.k === "call" && left.name === "starts_with") return { k: "bool", e: left }
    throw new Error(`"${describe(left)}" is not a condition (missing operator?)`)
  }
  function parseValue() {
    const t = peek()
    if (!t) throw new Error("unexpected end of expression")
    if (t.t === "str") return { k: "str", v: tokens[p++].v }
    if (t.t === "num") return { k: "num", v: tokens[p++].v }
    if (t.t === "ip") return { k: "ip", v: tokens[p++].v }
    if (t.t === "id") {
      p++
      if (peek()?.t === "(") {
        p++
        const args = []
        if (peek()?.t !== ")") {
          args.push(parseValue())
          while (peek()?.t === ",") {
            p++
            args.push(parseValue())
          }
        }
        expect(")")
        return { k: "call", name: t.v, args }
      }
      return { k: "field", name: t.v }
    }
    throw new Error(`unexpected token ${JSON.stringify(t)}`)
  }
  function parseSet() {
    expect("{")
    const items = []
    while (peek() && peek().t !== "}") {
      if (peek().t === ",") throw new Error("set items are separated by spaces, not commas")
      const v = parseValue()
      if (!["str", "num", "ip"].includes(v.k)) throw new Error("set items must be literals")
      items.push(v)
    }
    expect("}")
    if (items.length === 0) throw new Error("empty set")
    return { k: "set", items }
  }

  const ast = parseOr()
  if (p !== tokens.length) throw new Error(`unexpected token after the expression: ${JSON.stringify(tokens[p])}`)
  return ast
}

function describe(node) {
  return node.k === "field" ? node.name : node.k === "call" ? `${node.name}(...)` : node.k
}

// ------------------------------------------------------------- static checks

function check(node, usedFields, literals) {
  switch (node.k) {
    case "and":
    case "or":
      check(node.l, usedFields, literals)
      check(node.r, usedFields, literals)
      return
    case "not":
      check(node.e, usedFields, literals)
      return
    case "bool":
      check(node.e, usedFields, literals)
      return
    case "cmp":
      check(node.l, usedFields, literals)
      if (node.r.k === "set") node.r.items.forEach((x) => check(x, usedFields, literals))
      else check(node.r, usedFields, literals)
      if (node.op === "in" && node.l.k !== "field") throw new Error("the left side of `in` must be a field")
      if (node.op === "in" && node.l.name === "ip.src" && !node.r.items.every((x) => x.k === "ip"))
        throw new Error("ip.src can only be tested against IP literals")
      return
    case "call": {
      const arity = FUNCTIONS[node.name]
      if (arity === undefined) throw new Error(`unknown function ${node.name}`)
      if (node.args.length !== arity) throw new Error(`${node.name} takes ${arity} argument(s)`)
      if (node.name === "starts_with" && node.args[0].k === "str")
        throw new Error("the first argument of starts_with cannot be a literal")
      node.args.forEach((a) => check(a, usedFields, literals))
      return
    }
    case "field":
      if (!FIELDS.has(node.name)) throw new Error(`field ${node.name} is not in the allowed set`)
      usedFields.add(node.name)
      return
    case "str":
      literals.push(node.v)
      return
    case "ip":
    case "num":
      return
    default:
      throw new Error(`cannot check node ${node.k}`)
  }
}

function checkCase(src) {
  // Operators must be lowercase in Cloudflare's English notation.
  const bad = src.match(/(?<![A-Za-z0-9_."/])(AND|OR|NOT|EQ|NE|IN|CONTAINS)(?![A-Za-z0-9_"])/)
  if (bad && !/"[^"]*\b(AND|OR|NOT|EQ|NE|IN|CONTAINS)\b[^"]*"/.test(src))
    throw new Error(`operator ${bad[1]} must be lowercase`)
}

// --------------------------------------------------------------- evaluation

function ipToBig(text) {
  if (!text.includes(":")) {
    const parts = text.split(".").map(Number)
    if (parts.length !== 4 || parts.some((n) => !(n >= 0 && n <= 255))) throw new Error(`bad IPv4 ${text}`)
    return { v: 4, n: parts.reduce((a, b) => (a << 8n) | BigInt(b), 0n) }
  }
  const [head, tail] = text.split("::")
  const h = head ? head.split(":") : []
  const t = tail === undefined ? [] : tail ? tail.split(":") : []
  if (tail === undefined && h.length !== 8) throw new Error(`bad IPv6 ${text}`)
  const groups = tail === undefined ? h : [...h, ...Array(8 - h.length - t.length).fill("0"), ...t]
  if (groups.length !== 8) throw new Error(`bad IPv6 ${text}`)
  return { v: 6, n: groups.reduce((a, g) => (a << 16n) | BigInt(parseInt(g || "0", 16)), 0n) }
}

function ipMatches(ip, literal) {
  const [addr, len] = literal.split("/")
  const a = ipToBig(ip)
  const b = ipToBig(addr)
  if (a.v !== b.v) return false
  const bits = a.v === 4 ? 32n : 128n
  const prefix = len === undefined ? bits : BigInt(len)
  const shift = bits - prefix
  return a.n >> shift === b.n >> shift
}

// Cloudflare's documented normalization: merge slashes, decode percent-encoded
// unreserved characters, remove dot segments. Reserved characters are left alone.
function normalizePath(path) {
  let out = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/")
  out = out.replace(/%([0-9A-Fa-f]{2})/g, (m, hex) => {
    const c = String.fromCharCode(parseInt(hex, 16))
    return /[A-Za-z0-9\-._~]/.test(c) ? c : m.toUpperCase()
  })
  const stack = []
  for (const seg of out.split("/")) {
    if (seg === ".") continue
    if (seg === "..") stack.pop()
    else stack.push(seg)
  }
  const joined = stack.join("/")
  return joined.startsWith("/") ? joined : "/" + joined
}

function evaluate(node, req) {
  const value = (n) => {
    switch (n.k) {
      case "str":
      case "num":
      case "ip":
        return n.v
      case "field":
        return { "http.host": req.host, "http.request.uri.path": req.path, "ip.src": req.ip }[n.name]
      case "call": {
        const a = n.args.map(value)
        if (n.name === "lower") return a[0].replace(/[A-Z]/g, (c) => c.toLowerCase())
        if (n.name === "starts_with") return a[0].startsWith(a[1])
        throw new Error(n.name)
      }
      default:
        throw new Error(n.k)
    }
  }
  switch (node.k) {
    case "and":
      return evaluate(node.l, req) && evaluate(node.r, req)
    case "or":
      return evaluate(node.l, req) || evaluate(node.r, req)
    case "not":
      return !evaluate(node.e, req)
    case "bool":
      return value(node.e)
    case "cmp": {
      const l = value(node.l)
      if (node.op === "eq") return l === value(node.r)
      if (node.op === "ne") return l !== value(node.r)
      if (node.op === "contains") return l.includes(value(node.r))
      if (node.op === "in")
        return node.r.items.some((x) => (node.l.name === "ip.src" ? ipMatches(l, x.v) : x.v === l))
      throw new Error(node.op)
    }
    default:
      throw new Error(node.k)
  }
}

// ----------------------------------------------------------------- the tests

const API = "api.example.com.au"
const WWW = "www.example.com.au"
const DROPLET4 = "203.0.113.10"
const DROPLET6 = "2001:db8:0:1::10"
const OTHER4 = "198.51.100.7"
const rq = (host, path, ip = OTHER4) => ({ host, path: normalizePath(path), ip })

const CASES = {
  "stripe-webhook-skip": [
    [rq(API, "/hooks/payment/stripe_stripe"), true],
    [rq(API, "/hooks/payment/stripe_stripe/../stripe_stripe"), true],
    [rq(API, "/hooks/payment/other"), false],
    [rq(API, "/store/products"), false],
    [rq(WWW, "/hooks/payment/stripe_stripe"), false],
  ],
  "block-admin-paths-on-api": [
    ...[
      "/app", "/app/", "/App", "/APP/login", "/admin", "/admin/users/me", "/Admin/users",
      "/auth/user/emailpass", "/auth/session", "/auth/mfa/factors", "/AUTH/MFA/x",
      "/%61pp", "/%41dmin", "/./app", "//app", "/store/../app", "/store/../auth/user/emailpass",
    ].map((p) => [rq(API, p), true]),
    ...[
      "/", "/health", "/store/products", "/store/carts/cart_1", "/auth/customer/emailpass",
      "/auth/token/refresh", "/auth/verification/request", "/auth/verification/confirm", "/hooks/payment/stripe_stripe", "/static/app.png",
    ].map((p) => [rq(API, p), false]),
    [rq(WWW, "/admin"), false],
    [rq("admin.example.com.au", "/app"), false],
  ],
  "account-flood-guard": [
    [rq(WWW, "/au/account"), true],
    [rq(WWW, "/au/account/orders"), true],
    [rq(WWW, "/au/products/gold-ring"), false],
  ],
  "admin-login-guard": [
    [rq("admin.example.com.au", "/auth/user/emailpass"), true],
    [rq("admin.example.com.au", "/AUTH/User/EmailPass"), true],
    [rq("admin.example.com.au", "/auth/%75ser/emailpass"), true],
    [rq(API, "/auth/user/emailpass"), true],
    [rq(API, "/auth/customer/emailpass"), false],
    [rq("admin.example.com.au", "/app"), false],
  ],
  "store-api-skip-bic": [
    [rq(API, "/store/products"), true],
    [rq(API, "/health"), false],
    [rq(WWW, "/store/products"), false],
  ],
  "img-long-edge-ttl": [
    [rq("img.example.com.au", "/azira-images/a.jpg"), true],
    [rq(WWW, "/azira-images/a.jpg"), false],
  ],
}

// Per-rule structural expectations taken from the plan and the spec.
const EXPECT = {
  "block-admin-paths-on-api": ({ literals }) => {
    for (const prefix of ["/app", "/admin", "/auth/user", "/auth/session", "/auth/mfa"])
      if (!literals.includes(prefix)) throw new Error(`prefix ${prefix} is missing`)
    if (literals.some((l) => l.startsWith("/") && l !== l.toLowerCase()))
      throw new Error("path literals must be lower case (the path is lower-cased first)")
  },
  "account-flood-guard": ({ fields }) => {
    if ([...fields].some((f) => f !== "http.request.uri.path"))
      throw new Error("the Free plan allows only the Path and Verified Bot fields in a rate limit expression")
  },
}
const CUSTOM_RULES = ["stripe-webhook-skip", "block-admin-paths-on-api"]
const CONTINGENCY = ["store-api-skip-bic"]
const FREE_CUSTOM_RULE_LIMIT = 5

// ---------------------------------------------------------------------- run

let failures = 0
const fail = (msg) => {
  failures += 1
  console.error(`FAIL  ${msg}`)
}
const pass = (msg) => console.log(`ok    ${msg}`)

const md = readFileSync(RULES_MD, "utf8")
const blocks = [...md.matchAll(/```cf-expr rule=([a-z0-9-]+)\r?\n([\s\S]*?)\r?\n```/g)]
if (blocks.length === 0) fail("no cf-expr blocks found in rules.md")

const seen = new Set()
for (const [, name, raw] of blocks) {
  seen.add(name)
  let src = raw.trim()
  for (const [k, v] of Object.entries(PLACEHOLDERS)) src = src.split(k).join(v)
  try {
    if (src.includes("<")) throw new Error("an unreplaced <placeholder> remains")
    if (raw.trim().length > MAX_EXPRESSION_LENGTH) throw new Error(`longer than ${MAX_EXPRESSION_LENGTH} characters`)
    checkCase(src)
    const ast = parse(src)
    const fields = new Set()
    const literals = []
    check(ast, fields, literals)
    EXPECT[name]?.({ ast, fields, literals })
    pass(`${name}: parses (${raw.trim().length} chars, fields: ${[...fields].join(", ")})`)
    const cases = CASES[name]
    if (!cases) {
      fail(`${name}: no test cases`)
      continue
    }
    for (const [req, want] of cases) {
      const got = evaluate(ast, req)
      if (got !== want) fail(`${name}: ${req.host}${req.path} from ${req.ip} gave ${got}, expected ${want}`)
    }
    pass(`${name}: ${cases.length} test requests behave as expected`)
  } catch (e) {
    fail(`${name}: ${e.message}`)
  }
}

for (const name of [...CUSTOM_RULES, ...Object.keys(CASES)])
  if (!seen.has(name)) fail(`rule ${name} has no cf-expr block in rules.md`)

const customCount = CUSTOM_RULES.length + CONTINGENCY.length
if (customCount > FREE_CUSTOM_RULE_LIMIT) fail(`${customCount} custom rules exceed the Free plan limit of ${FREE_CUSTOM_RULE_LIMIT}`)
else pass(`custom rules: ${CUSTOM_RULES.length} + ${CONTINGENCY.length} in reserve, limit ${FREE_CUSTOM_RULE_LIMIT}`)

// Negative self-test: the checker must reject known-bad expressions.
const BAD = [
  ['http.host eq "a" AND http.request.uri.path eq "/x"', "uppercase operator"],
  ['http.host eq "a" and (http.request.uri.path eq "/x"', "unbalanced parenthesis"],
  ['http.host eq "a', "unterminated string"],
  ['starts_with("abc", "a")', "literal as starts_with source"],
  ['ip.src in {203.0.113.10, 203.0.113.11}', "comma in a set"],
  ['http.request.uri.path matches "^/app"', "unknown operator (regex)"],
  ['lower(http.request.uri.path) eq', "missing operand"],
  ['http.request.uri.path wildcard "/app*"', "unknown operator"],
]
for (const [src, why] of BAD) {
  try {
    checkCase(src)
    const ast = parse(src)
    check(ast, new Set(), [])
    fail(`negative self-test accepted a bad expression (${why})`)
  } catch {
    /* expected */
  }
}
pass(`negative self-test: ${BAD.length} bad expressions rejected`)

if (failures > 0) {
  console.error(`\n${failures} problem(s)`)
  process.exit(1)
}
console.log("\nAll rule expressions pass.")
