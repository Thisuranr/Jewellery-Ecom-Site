import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, PaymentEvents } from "@medusajs/framework/utils"
import { formatAud } from "../modules/email/templates/strings"
import { firstName, num, orderAccountUrl, type OrderRecord } from "../lib/email-data"
import { logFailure, sendEmail } from "../lib/send-email"

/**
 * Tells the customer a refund was made. `payment.refunded` carries `{ id: <payment id> }`; the
 * refund is the payment's newest refund. A failure is logged, never thrown back into the event.
 */
export default async function refundIssuedEmail({ event: { data }, container }: SubscriberArgs<{ id?: string }>) {
  const paymentId = data?.id
  if (typeof paymentId !== "string" || !paymentId) {
    return
  }
  await logFailure(container, `the refund email for payment ${paymentId}`, async () => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["id", "refunds.amount", "refunds.created_at", "payment_collection.order.id"],
      filters: { id: paymentId },
    })
    const payment = payments[0] as unknown as
      | {
          refunds?: Array<{ amount: unknown; created_at: string | Date }>
          payment_collection?: { order?: { id: string } | null } | null
        }
      | undefined
    const orderId = payment?.payment_collection?.order?.id
    const refund = [...(payment?.refunds ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    if (!orderId || !refund) {
      return
    }
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email", "customer.first_name", "shipping_address.first_name"],
      filters: { id: orderId },
    })
    const order = orders[0] as unknown as OrderRecord | undefined
    if (!order?.email) {
      return
    }
    await sendEmail(container, {
      to: order.email,
      template: "refund-issued",
      data: {
        order_display_id: String(order.display_id ?? order.id),
        first_name: firstName(order),
        refund_str: formatAud(num(refund.amount)),
        order_url: orderAccountUrl(order),
      },
    })
  })
}

export const config: SubscriberConfig = {
  event: PaymentEvents.REFUNDED,
  context: { subscriberId: "refund-issued-email" },
}
