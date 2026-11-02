import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { ATTRIBUTE_DEFINITION_UPDATED } from "../../lib/events"
import { localeValuesFromL10n } from "../../lib/translations"
import { syncTranslationsWorkflow } from "../translations/sync-translations"
import {
  updateAttributeDefinitionStep,
  UpdateAttributeInput,
  validateUpdateAttributeStep,
} from "./steps/attribute-definition"

export type { UpdateAttributeInput } from "./steps/attribute-definition"

/**
 * Updates an attribute's label, unit, group, flags or rank. Sending `handle`
 * or `type` fails with `handle_immutable` / `type_immutable`. Emits
 * `attribute-definition.updated` (M2 B1).
 */
export const updateAttributeWorkflow = createWorkflow(
  "update-attribute",
  (input: UpdateAttributeInput) => {
    validateUpdateAttributeStep(input)
    const updated = updateAttributeDefinitionStep(input)

    const translations = transform({ input }, ({ input }) => ({
      reference: "attribute_definition",
      items:
        input.label === undefined
          ? []
          : [{ reference_id: input.id, values: localeValuesFromL10n({ label: input.label }) }],
    }))
    syncTranslationsWorkflow.runAsStep({ input: translations })

    const eventData = transform({ input }, ({ input }) => ({ id: input.id }))
    emitEventStep({ eventName: ATTRIBUTE_DEFINITION_UPDATED, data: eventData })

    return new WorkflowResponse(updated)
  }
)
