import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, OrderWorkflowEvents } from "@medusajs/framework/utils"
import { ORDER_EMAIL_FIELDS, orderConfirmedData, staffNewOrderData, type OrderRecord } from "../lib/email-data"
import { logFailure, sendEmail } from "../lib/send-email"

/**
 * When an order is placed (Stripe payment captured): the customer's receipt and the
 * "new order" alert to the store owner (STORE_NOTIFY_EMAIL). They fail separately, and a
 * failure is logged, never thrown back into the event.
 */
export default async function orderPlacedEmails({ event: { data }, container }: SubscriberArgs<{ id?: string }>) {
  const orderId = data?.id
  if (typeof orderId !== "string" || !orderId) {
    return
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let order: OrderRecord | undefined
  try {
    const { data: orders } = await query.graph({ entity: "order", fields: ORDER_EMAIL_FIELDS, filters: { id: orderId } })
    order = orders[0] as unknown as OrderRecord | undefined
  } catch (error) {
    logger.error(`[email] order ${orderId} could not be read for its emails: ${(error as Error)?.message}`)
    return
  }
  if (!order) {
    return
  }
  const placed = order

  if (placed.email) {
    await logFailure(container, `the receipt for order ${orderId}`, () =>
      sendEmail(container, { to: placed.email as string, template: "order-confirmed", data: orderConfirmedData(placed) })
    )
  }
  const owner = process.env.STORE_NOTIFY_EMAIL?.trim()
  if (owner) {
    await logFailure(container, `the new-order alert for order ${orderId}`, () =>
      sendEmail(container, { to: owner, template: "staff-new-order", data: staffNewOrderData(placed) })
    )
  } else {
    logger.warn("[email] STORE_NOTIFY_EMAIL is not set, so no new-order alert was sent")
  }
}

export const config: SubscriberConfig = {
  event: OrderWorkflowEvents.PLACED,
  context: { subscriberId: "order-placed-emails" },
}
