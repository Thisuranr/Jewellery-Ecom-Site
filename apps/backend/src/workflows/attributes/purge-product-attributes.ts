import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { purgeTranslationsStep } from "../translations/steps/purge-translations"
import { deleteProductAttributeRowsStep, loadProductAttributeRowsStep } from "./steps/purge"

export type PurgeProductAttributesInput = { product_ids: string[] }

/**
 * Hard-deletes every attribute value and option row of the given products,
 * with the `value_text` translations (G2 review finding 1). Run by the
 * `product.deleted` subscriber, and by the attribute and option deletes for
 * rows of products that are already gone. Compensated: a failure re-creates
 * the rows and translations with their ids.
 */
export const purgeProductAttributesWorkflow = createWorkflow(
  "purge-product-attributes",
  (input: PurgeProductAttributesInput) => {
    const rows = loadProductAttributeRowsStep(input)
    const deleted = deleteProductAttributeRowsStep(rows)
    const referenceIds = transform({ rows }, ({ rows }) => rows.values.map((row) => row.id))
    purgeTranslationsStep({ reference_ids: referenceIds })

    const result = transform({ input, deleted }, ({ input, deleted }) => ({
      product_ids: input.product_ids,
      values: deleted.values,
      options: deleted.options,
    }))
    return new WorkflowResponse(result)
  }
)
