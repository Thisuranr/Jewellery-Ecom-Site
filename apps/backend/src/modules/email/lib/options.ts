import { MedusaError } from "@medusajs/framework/utils"
import { isMailbox } from "./address"

export const EMAIL_TRANSPORTS = ["console", "resend"] as const
export type EmailTransportName = (typeof EMAIL_TRANSPORTS)[number]

/**
 * Provider options (medusa-config.ts passes these to the notification module,
 * src/lib/email-config.ts builds them from the environment).
 *
 * - transport: "console" renders the real template and logs it; "resend" sends
 *   through Resend.
 * - from: the sender, `a@b.com.au` or `Name <a@b.com.au>`. Required for Resend. Always
 *   the configured one: the provider ignores `notification.from`, so the
 *   sender identity (SPF, DKIM, DMARC) is one setting.
 * - reply_to: optional, the monitored inbox.
 * - api_key: the Resend API key. Required for Resend; never logged.
 * - outbox_dir: console only, outside production. A folder that gets an HTML
 *   copy of every email.
 */
export type EmailProviderOptions = {
  channels?: string[]
  transport: EmailTransportName
  from?: string
  reply_to?: string
  api_key?: string
  outbox_dir?: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Checks the options and returns them in their typed form. Throws one
 * MedusaError that names every wrong option and the variable it comes from,
 * never a value (an API key must not reach a log). An empty string counts as
 * "not set", as it does everywhere in the app (a copied .env.template ships
 * empty values).
 */
export function parseEmailOptions(options: Record<string, unknown> | undefined): EmailProviderOptions {
  const o = options ?? {}
  const problems: string[] = []

  const transport = o.transport
  if (transport !== "console" && transport !== "resend") {
    problems.push('transport (EMAIL_TRANSPORT, "console" or "resend")')
  }

  const apiKey = isNonEmptyString(o.api_key) ? o.api_key.trim() : undefined
  if (o.api_key !== undefined && o.api_key !== null && typeof o.api_key !== "string") {
    problems.push("api_key (RESEND_API_KEY, a string)")
  }
  if (transport === "resend" && !apiKey) {
    problems.push("api_key (RESEND_API_KEY, required when the transport is resend)")
  }

  const from = isNonEmptyString(o.from) ? o.from.trim() : undefined
  if (from !== undefined && !isMailbox(from)) {
    problems.push('from (EMAIL_FROM, "name@example.com.au" or "Name <name@example.com.au>")')
  }
  if (transport === "resend" && !from) {
    problems.push("from (EMAIL_FROM, required when the transport is resend)")
  }

  const replyTo = isNonEmptyString(o.reply_to) ? o.reply_to.trim() : undefined
  if (replyTo !== undefined && !isMailbox(replyTo)) {
    problems.push("reply_to (EMAIL_REPLY_TO, an email address)")
  }

  const outbox = isNonEmptyString(o.outbox_dir) ? o.outbox_dir.trim() : undefined
  if (o.outbox_dir !== undefined && o.outbox_dir !== null && typeof o.outbox_dir !== "string") {
    problems.push("outbox_dir (EMAIL_OUTBOX_DIR, a folder path)")
  }

  if (problems.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      `Email provider is missing or has invalid options: ${problems.join("; ")}`
    )
  }

  return {
    channels: Array.isArray(o.channels) ? (o.channels as string[]) : undefined,
    transport: transport as EmailTransportName,
    from,
    reply_to: replyTo,
    api_key: apiKey,
    outbox_dir: outbox,
  }
}
