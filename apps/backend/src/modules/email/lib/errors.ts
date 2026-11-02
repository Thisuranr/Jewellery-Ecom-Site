import { MedusaError } from "@medusajs/framework/utils"
import { codedError } from "../../../lib/coded-error"

/**
 * Every failure of the email provider is a coded error ("<code>: <text>"), so a
 * notification row marked failed and a log line carry the
 * same stable code. The text never holds a reset link, a token or a full
 * address.
 */
export const EMAIL_ERROR = {
  /** The notification names a template this provider does not have. */
  unknownTemplate: "unknown_template",
  /** The template's data is missing a required field or holds a bad value. */
  invalidTemplateData: "invalid_template_data",
  /** The notification's channel is not "email" or its `to` is not an address. */
  invalidRecipient: "invalid_recipient",
  unsupportedChannel: "unsupported_channel",
  /** The transport (Resend) did not accept the message. */
  sendFailed: "email_send_failed",
  /** React cannot be loaded here, so no template can render (see render.ts). */
  renderUnavailable: "email_render_unavailable",
} as const

export type EmailErrorCode = (typeof EMAIL_ERROR)[keyof typeof EMAIL_ERROR]

export function emailError(
  code: EmailErrorCode,
  text: string,
  type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types] = MedusaError.Types.INVALID_DATA
): MedusaError {
  return codedError(type, code, text)
}
