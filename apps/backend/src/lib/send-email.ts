import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { TemplateName } from "../modules/email/templates/names"

/**
 * Sends one email through the notification module (the `email` channel is served
 * by src/modules/email). Medusa records a notification row either way. `reply_to`
 * is read by the provider when it is one plain address.
 */
export async function sendEmail(
  container: Pick<MedusaContainer, "resolve">,
  input: { to: string; template: TemplateName; data: Record<string, unknown>; replyTo?: string }
): Promise<void> {
  const notifications = container.resolve(Modules.NOTIFICATION)
  await notifications.createNotifications({
    to: input.to,
    channel: "email",
    template: input.template,
    data: input.replyTo ? { ...input.data, reply_to: input.replyTo } : input.data,
  })
}

/** Runs `work`; a failure is logged (with a label that holds no address) and never thrown. */
export async function logFailure(
  container: Pick<MedusaContainer, "resolve">,
  label: string,
  work: () => Promise<void>
): Promise<void> {
  try {
    await work()
  } catch (error) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    logger.error(`[email] ${label} was not sent: ${(error as Error)?.message ?? "unknown error"}`)
  }
}
