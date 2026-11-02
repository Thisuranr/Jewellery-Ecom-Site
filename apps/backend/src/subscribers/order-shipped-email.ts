import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, FulfillmentWorkflowEvents } from "@medusajs/framework/utils"
import { ORDER_EMAIL_FIELDS, addressLines, emailItems, firstName, orderAccountUrl, type OrderRecord } from "../lib/email-data"
import { logFailure, sendEmail } from "../lib/send-email"

/**
 * Tells the customer an order has shipped. `shipment.created` carries `{ id: <fulfilment id>,
 * no_notification }`. A failure is logged, never thrown back into the event.
 */
export default async function orderShippedEmail({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string; no_notification?: boolean }>) {
  const fulfillmentId = data?.id
  if (typeof fulfillmentId !== "string" || !fulfillmentId || data?.no_notification === true) {
    return
  }
  await logFailure(container, `the shipped email for fulfilment ${fulfillmentId}`, async () => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [...ORDER_EMAIL_FIELDS, "fulfillments.id", "fulfillments.labels.tracking_number", "fulfillments.labels.tracking_url"],
      filters: { fulfillments: { id: fulfillmentId } } as Record<string, unknown>,
    })
    const order = orders[0] as unknown as
      | (OrderRecord & {
          fulfillments?: Array<{ id: string; labels?: Array<{ tracking_number?: string; tracking_url?: string }> }>
        })
      | undefined
    if (!order?.email) {
      return
    }
    const fulfillment = order.fulfillments?.find((f) => f.id === fulfillmentId)
    const tracking = (fulfillment?.labels ?? [])
      .filter((l) => l.tracking_number)
      .map((l) => ({
        number: l.tracking_number as string,
        url: l.tracking_url && /^https:\/\//u.test(l.tracking_url) ? l.tracking_url : undefined,
      }))
    await sendEmail(container, {
      to: order.email,
      template: "order-shipped",
      data: {
        order_display_id: String(order.display_id ?? order.id),
        first_name: firstName(order),
        items: emailItems(order),
        tracking,
        address_lines: addressLines(order),
        order_url: orderAccountUrl(order),
      },
    })
  })
}

export const config: SubscriberConfig = {
  event: FulfillmentWorkflowEvents.SHIPMENT_CREATED,
  context: { subscriberId: "order-shipped-email" },
}
