import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deleteTranslationsWorkflow, emitEventStep } from "@medusajs/medusa/core-flows"
import { ATTRIBUTE_DEFINITION_UPDATED } from "../../lib/events"
import { loadExistingTranslationsStep } from "../translations/steps/load-existing-translations"
import { purgeProductAttributesWorkflow } from "./purge-product-attributes"
import { softDeleteAttributeStep, validateDeleteAttributeStep } from "./steps/attribute-definition"

/**
 * Deletes an attribute with its category links, options and their
 * translations. Fails with `attribute_in_use` while any live product has a
 * value. Rows left by deleted products are removed first (G2 review finding 1).
 * Emits `attribute-definition.updated` (M2 B1).
 */
export const deleteAttributeWorkflow = createWorkflow(
  "delete-attribute",
  (input: { id: string }) => {
    const target = validateDeleteAttributeStep(input)
    const orphans = transform({ target }, ({ target }) => ({ product_ids: target.orphan_product_ids }))
    purgeProductAttributesWorkflow.runAsStep({ input: orphans })
    softDeleteAttributeStep(target)

    const referenceIds = transform({ target }, ({ target }) => [
      target.definition_id,
      ...target.option_ids,
    ])
    const existing = loadExistingTranslationsStep({ reference_ids: referenceIds })
    const translationIds = transform({ existing }, ({ existing }) => existing.map((row) => row.id))
    when("delete-attribute-has-translations", { translationIds }, ({ translationIds }) => {
      return translationIds.length > 0
    }).then(() => {
      deleteTranslationsWorkflow.runAsStep({ input: { ids: translationIds } })
    })

    const eventData = transform({ target }, ({ target }) => ({ id: target.definition_id }))
    emitEventStep({ eventName: ATTRIBUTE_DEFINITION_UPDATED, data: eventData })

    const result = transform({ target }, ({ target }) => ({
      id: target.definition_id,
      object: "attribute",
      deleted: true,
    }))
    return new WorkflowResponse(result)
  }
)
