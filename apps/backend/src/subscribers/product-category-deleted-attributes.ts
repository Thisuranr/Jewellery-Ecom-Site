import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, ProductCategoryWorkflowEvents } from "@medusajs/framework/utils"
import { purgeCategoryLinksWorkflow } from "../workflows/attributes/purge-category-links"
import { eventIds } from "../lib/events"

/**
 * A deleted category's attribute links are hard-deleted (G2 review finding 1).
 * Medusa's deleteProductCategoriesWorkflow emits `product-category.deleted`
 * with `{ id }`; without this the links pointed at a category that is gone.
 */
async function productCategoryDeletedAttributesHandler({
  event,
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const categoryIds = eventIds(event.data)
  if (!categoryIds.length) {
    return
  }
  try {
    await purgeCategoryLinksWorkflow(container).run({ input: { category_ids: categoryIds } })
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `Attribute links of deleted category(ies) ${categoryIds.join(", ")} not removed: ${
          (error as { message?: string })?.message ?? String(error)
        }`
      )
    throw error
  }
}

export default productCategoryDeletedAttributesHandler

export const config: SubscriberConfig = {
  event: ProductCategoryWorkflowEvents.DELETED,
  context: { subscriberId: "product-category-deleted-attributes" },
}
