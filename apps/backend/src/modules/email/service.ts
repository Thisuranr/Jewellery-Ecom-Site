import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import { isEmailAddress } from "./lib/address"
import { reportBootProblems } from "./lib/boot-checks"
import { EMAIL_ERROR, emailError } from "./lib/errors"
import { parseEmailOptions, type EmailProviderOptions } from "./lib/options"
import { renderEmail } from "./lib/render"
import {
  createConsoleTransport,
  createResendTransport,
  resendClientFor,
  type EmailLogger,
  type EmailTransport,
} from "./lib/transports"

/**
 * Email notification provider, built from Medusa's
 * Resend guide. It serves the `email` channel. A notification names a
 * `template` ("password-reset") and carries its `data`; the provider renders
 * the React Email template, then hands the
 * result to the configured transport:
 *
 * - console: logs the email (and writes an HTML copy to `outbox_dir` outside
 *   production). Used while there is no Resend account.
 * - resend: sends it through Resend. The notification fails (and Medusa marks
 *   it failed) when Resend does not accept it; unlike the guide's example, the
 *   provider throws instead of returning an empty result, so a failed reset
 *   email is never recorded as sent.
 *
 * Provider id: np_notification-email_email (identifier + the id in
 * medusa-config.ts).
 */
class EmailNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-email"

  protected readonly options_: EmailProviderOptions
  protected readonly transport_: EmailTransport
  protected readonly logger_: EmailLogger

  /**
   * Medusa calls this at boot, before the provider is built. It throws when an
   * option is wrong (the backend then refuses to start, naming the variable)
   * and logs what is legal but risky (console in production, React missing).
   */
  static validateOptions(options: Record<string, unknown>): void {
    reportBootProblems(parseEmailOptions(options))
  }

  constructor(container: { logger?: EmailLogger }, options: Record<string, unknown>) {
    super()
    this.options_ = parseEmailOptions(options)
    const logger: EmailLogger = container.logger ?? console
    this.logger_ = logger
    this.transport_ =
      this.options_.transport === "resend"
        ? createResendTransport(resendClientFor(this.options_.api_key as string))
        : createConsoleTransport({ logger, outboxDir: this.options_.outbox_dir })
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No notification information provided")
    }
    if (notification.channel !== "email") {
      throw emailError(EMAIL_ERROR.unsupportedChannel, `the email provider serves the email channel only`)
    }
    const to = typeof notification.to === "string" ? notification.to.trim() : ""
    if (!isEmailAddress(to)) {
      throw emailError(EMAIL_ERROR.invalidRecipient, "to is not an email address")
    }

    const rendered = await renderEmail(notification.template, notification.data)
    // A notification may name one reply-to address (a custom order enquiry replies to the
    // customer). It must be one plain address; anything else falls back to the configured one.
    const dataReplyTo = (notification.data as { reply_to?: unknown } | null | undefined)?.reply_to
    const replyTo = isEmailAddress(dataReplyTo) ? dataReplyTo : this.options_.reply_to
    const { id } = await this.transport_.send({
      template: notification.template,
      to,
      // Always the configured sender, never notification.from (see options.ts).
      from: this.options_.from,
      replyTo,
      ...rendered,
    })
    return { id }
  }
}

export default EmailNotificationProviderService
