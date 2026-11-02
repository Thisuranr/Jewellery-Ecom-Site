import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { AuthWorkflowEvents, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { maskEmail } from "../modules/email/lib/address"
import { passwordResetLink } from "../lib/password-reset-link"
import { sendEmail } from "../lib/send-email"

/**
 * Sends the reset email for a customer (a link to the storefront) or an admin user (a link to
 * the admin app). `POST /auth/{actor}/emailpass/reset-password` answers 201 whatever happens,
 * so a failure is logged, never thrown back. No log line carries the token or the link.
 */
export default async function passwordResetEmail({
  event: { data },
  container,
}: SubscriberArgs<{ entity_id?: string; actor_type?: string; token?: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = passwordResetLink(data ?? {})
  if (!link) {
    logger.debug("[password-reset] skipped: not a customer or user reset, or the event is incomplete")
    return
  }
  try {
    await sendEmail(container, {
      to: link.email,
      template: "password-reset",
      data: { reset_url: link.url, expires_minutes: 15 },
    })
  } catch (error) {
    const message = String((error as Error)?.message ?? "unknown error").split(String(data?.token)).join("[token]")
    logger.error(`[password-reset] the reset email for ${maskEmail(link.email)} was not sent: ${message}`)
  }
}

export const config: SubscriberConfig = {
  event: AuthWorkflowEvents.PASSWORD_RESET,
  context: { subscriberId: "password-reset-email" },
}
