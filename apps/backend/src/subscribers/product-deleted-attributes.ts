import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, ProductWorkflowEvents } from "@medusajs/framework/utils"
import { purgeProductAttributesWorkflow } from "../workflows/attributes/purge-product-attributes"
import { eventIds } from "../lib/events"

/**
 * A deleted product's attribute values and options, with their translations,
 * are hard-deleted (G2 review finding 1). Medusa's deleteProductsWorkflow
 * soft-deletes the product and emits `product.deleted` with `{ id }`; without
 * this the rows stayed and blocked deleting their option or attribute.
 */
async function productDeletedAttributesHandler({
  event,
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const productIds = eventIds(event.data)
  if (!productIds.length) {
    return
  }
  try {
    await purgeProductAttributesWorkflow(container).run({ input: { product_ids: productIds } })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `Attribute rows of deleted product(s) ${productIds.join(", ")} not removed: ${
          (error as { message?: string })?.message ?? String(error)
        }`
      )
    throw error
  }
}

export default productDeletedAttributesHandler

export const config: SubscriberConfig = {
  event: ProductWorkflowEvents.DELETED,
  context: { subscriberId: "product-deleted-attributes" },
}
