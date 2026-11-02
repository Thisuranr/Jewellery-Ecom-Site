import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { emitEventStep, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { PRODUCT_ATTRIBUTES_UPDATED } from "../../lib/events"
import { syncTranslationsWorkflow } from "../translations/sync-translations"
import {
  applyProductAttributeDiffStep,
  loadProductAttributeContextStep,
  planProductAttributesStep,
  SetProductAttributesInput,
} from "./steps/product-attributes"

export type { SetProductAttributesInput } from "./steps/product-attributes"

/**
 * Sets a product's attribute values (an attribute left out is cleared) and,
 * optionally, its staff search keywords (plan M1 B3):
 * 1. load the categories, effective set and existing rows;
 * 2. plan the diff and throw the first error, naming every handle;
 * 3. apply the diff (compensated with the old rows and ids);
 * 4. sync the value_text translations;
 * 5. if the keywords changed, update the product with the full merged metadata;
 * 6. emit `product-attributes.updated`.
 */
export const setProductAttributesWorkflow = createWorkflow(
  "set-product-attributes",
  (input: SetProductAttributesInput) => {
    const context = loadProductAttributeContextStep(input)
    const planned = planProductAttributesStep({ context, input })

    const applyInput = transform({ input, context, planned }, ({ input, context, planned }) => ({
      product_id: input.product_id,
      plan: planned.plan,
      existing_values: context.existing_values,
      existing_options: context.existing_options,
    }))
    const applied = applyProductAttributeDiffStep(applyInput)

    const translations = transform({ planned, applied }, ({ planned, applied }) => ({
      reference: "product_attribute_value",
      items: planned.plan.textTranslations
        .map((entry) => ({
          reference_id: entry.value_id ?? applied.created_value_ids[entry.attribute_id],
          values: entry.values,
        }))
        .filter((item) => !!item.reference_id),
    }))
    syncTranslationsWorkflow.runAsStep({ input: translations })

    when("set-product-attributes-keywords-changed", { planned }, ({ planned }) => {
      return planned.metadata !== null
    }).then(() => {
      // The `products` form, not `selector`/`update`: the selector form's
      // compensation snapshots only the fields it derives from the update
      // object, and it reads `metadata` as a relation, so a failure later in
      // an outer workflow would not restore the old metadata (tested).
      const update = transform({ input, planned }, ({ input, planned }) => ({
        products: [{ id: input.product_id, metadata: planned.metadata! }],
      }))
      updateProductsWorkflow.runAsStep({ input: update })
    })

    const eventData = transform({ input }, ({ input }) => ({ id: input.product_id }))
    emitEventStep({ eventName: PRODUCT_ATTRIBUTES_UPDATED, data: eventData })

    const result = transform({ input, planned }, ({ input, planned }) => ({
      product_id: input.product_id,
      created: planned.plan.createValues.length + planned.plan.createOptions.length,
      updated: planned.plan.updateValues.length,
      deleted: planned.plan.deleteValueIds.length + planned.plan.deleteOptionIds.length,
    }))
    return new WorkflowResponse(result)
  }
)
