import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deleteTranslationsWorkflow, emitEventStep } from "@medusajs/medusa/core-flows"
import { ATTRIBUTE_OPTION_UPDATED } from "../../lib/events"
import { loadExistingTranslationsStep } from "../translations/steps/load-existing-translations"
import { purgeProductAttributesWorkflow } from "./purge-product-attributes"
import {
  DeleteAttributeOptionInput,
  softDeleteAttributeOptionStep,
  validateDeleteAttributeOptionStep,
} from "./steps/attribute-option"

export type { DeleteAttributeOptionInput } from "./steps/attribute-option"

/**
 * Deletes an option and its translations. Fails with `option_in_use` while a
 * live product uses it; rows left by deleted products are removed first (G2
 * review finding 1). Emits `attribute-option.updated` for the removed option,
 * so the storefront re-reads its filters even when the option had no
 * translations (M2 B1); the search index finds no product holding it.
 */
export const deleteAttributeOptionWorkflow = createWorkflow(
  "delete-attribute-option",
  (input: DeleteAttributeOptionInput) => {
    const target = validateDeleteAttributeOptionStep(input)
    const orphans = transform({ target }, ({ target }) => ({ product_ids: target.orphan_product_ids }))
    purgeProductAttributesWorkflow.runAsStep({ input: orphans })
    softDeleteAttributeOptionStep(target)

    const referenceIds = transform({ target }, ({ target }) => [target.id])
    const existing = loadExistingTranslationsStep({ reference_ids: referenceIds })
    const translationIds = transform({ existing }, ({ existing }) => existing.map((row) => row.id))
    when("delete-attribute-option-has-translations", { translationIds }, ({ translationIds }) => {
      return translationIds.length > 0
    }).then(() => {
      deleteTranslationsWorkflow.runAsStep({ input: { ids: translationIds } })
    })

    const eventData = transform({ target }, ({ target }) => ({ id: target.id }))
    emitEventStep({ eventName: ATTRIBUTE_OPTION_UPDATED, data: eventData })

    const result = transform({ target }, ({ target }) => ({
      id: target.id,
      object: "attribute_option",
      deleted: true,
    }))
    return new WorkflowResponse(result)
  }
)
