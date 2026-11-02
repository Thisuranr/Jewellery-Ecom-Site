import { randomBytes } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import { Resend } from "resend"
import { isProductionNodeEnv } from "../../../lib/production-env"
import { maskEmail } from "./address"
import { EMAIL_ERROR, emailError } from "./errors"

/** One rendered email, ready to hand to a transport. */
export type OutgoingEmail = {
  template: string
  to: string
  from?: string
  replyTo?: string
  subject: string
  html: string
  text: string
}

export type EmailTransport = {
  send(email: OutgoingEmail): Promise<{ id: string }>
}

/** The part of the Medusa logger the transports use. */
export type EmailLogger = {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

/**
 * Production as Medusa and `production-env.ts` read NODE_ENV ("production" or
 * "prod"; R1 #3). NODE_ENV is read on every call, so a test (or a restart) can
 * change it.
 */
export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return isProductionNodeEnv(env)
}

// The only processes that may log an email body or write the outbox.
const LOCAL_NODE_ENVS = new Set(["development", "test"])

/**
 * True only for a development or test process (`medusa develop` sets
 * development, jest sets test). Anything else, unset included, may be a live
 * server, so the body and its reset link stay out of the logs (R1 #3: with
 * NODE_ENV=prod the old `=== "production"` check printed them).
 */
export function mayRevealBodies(env: NodeJS.ProcessEnv = process.env): boolean {
  return LOCAL_NODE_ENVS.has(env.NODE_ENV ?? "")
}

function safeFileName(template: string): string {
  return template.replace(/[^a-z0-9_-]/giu, "_")
}

/** 2026-10-29T12:34:56.789Z becomes 2026-10-29T12-34-56-789Z: colons are not allowed in Windows file names. */
function fileStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/gu, "-")
}

/**
 * Writes the HTML copy; never overwrites (two emails in the same millisecond
 * get -1, -2). A failed write is logged and ignored: the outbox is a
 * development aid and must not turn a working reset into a failed one.
 */
function writeOutbox(dir: string, email: OutgoingEmail, logger: EmailLogger, now: Date): string | null {
  try {
    mkdirSync(dir, { recursive: true })
    const base = `${fileStamp(now)}-${safeFileName(email.template)}`
    for (let attempt = 0; attempt < 100; attempt++) {
      const file = join(dir, attempt === 0 ? `${base}.html` : `${base}-${attempt}.html`)
      try {
        writeFileSync(file, email.html, { encoding: "utf8", flag: "wx" })
        return file
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          throw error
        }
      }
    }
    logger.warn("[email:console] could not write the outbox copy: no free file name")
    return null
  } catch (error) {
    logger.warn(`[email:console] could not write the outbox copy: ${(error as Error).message}`)
    return null
  }
}

/**
 * Logs the email instead of sending it. It renders the real template first
 * (the caller does), so development exercises the same code as production.
 *
 * In development and test only (`mayRevealBodies`) it also logs the
 * plain-text body, which holds the reset link, and writes the HTML to
 * `outboxDir` when one is set. Anywhere else it logs the recipient (masked),
 * template and subject only: no body, no link, no file. A console transport in production sends nothing to anyone; the boot
 * check says so loudly.
 */
export function createConsoleTransport(options: {
  logger: EmailLogger
  outboxDir?: string
  env?: NodeJS.ProcessEnv
  now?: () => Date
}): EmailTransport {
  const { logger, outboxDir } = options
  const env = options.env
  const now = options.now ?? (() => new Date())
  return {
    async send(email) {
      logger.info(
        `[email:console] template=${email.template} to=${maskEmail(email.to)} subject=${JSON.stringify(email.subject)}`
      )
      if (mayRevealBodies(env)) {
        logger.info(`[email:console] text body of ${email.template}:\n${email.text}`)
        if (outboxDir) {
          const file = writeOutbox(outboxDir, email, logger, now())
          if (file) {
            logger.info(`[email:console] html copy: ${file}`)
          }
        }
      }
      return { id: `console_${randomBytes(8).toString("hex")}` }
    },
  }
}

/**
 * Cleans a message from the provider before it reaches an error or a log: the
 * recipient's address is masked and any link becomes [link] (a provider could
 * echo part of what we sent, and our emails carry reset links).
 */
function redactAddress(message: string, to: string): string {
  return message
    .split(to)
    .join(maskEmail(to))
    .replace(/https?:\/\/\S+/giu, "[link]")
}

/** The slice of the Resend client the transport uses (so a test can pass a fake). */
export type ResendClient = {
  emails: {
    send(payload: {
      from: string
      to: string
      subject: string
      html: string
      text: string
      replyTo?: string
    }): Promise<{
      data: { id: string } | null
      error: { name?: string; message?: string; statusCode?: number | null } | null
    }>
  }
}

export function createResendTransport(client: ResendClient): EmailTransport {
  const failed = (email: OutgoingEmail, detail: string) =>
    emailError(
      EMAIL_ERROR.sendFailed,
      `${email.template} to ${maskEmail(email.to)} was not sent (${detail})`,
      MedusaError.Types.UNEXPECTED_STATE
    )
  return {
    async send(email) {
      if (!email.from) {
        throw failed(email, "no sender configured")
      }
      let result: Awaited<ReturnType<ResendClient["emails"]["send"]>>
      try {
        result = await client.emails.send({
          from: email.from,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        })
      } catch (error) {
        throw failed(email, redactAddress(String((error as Error)?.message ?? "request failed"), email.to).slice(0, 200))
      }
      if (result.error || !result.data?.id) {
        const e = result.error
        const detail = e
          ? [e.name, e.statusCode ? `status ${e.statusCode}` : null, e.message ? redactAddress(e.message, email.to) : null]
              .filter(Boolean)
              .join(", ")
              .slice(0, 200)
          : "no id returned"
        throw failed(email, detail)
      }
      return { id: result.data.id }
    },
  }
}

/** The real Resend client for an API key. */
export function resendClientFor(apiKey: string): ResendClient {
  return new Resend(apiKey) as unknown as ResendClient
}
