import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { ATTRIBUTE_OPTION_UPDATED } from "../../lib/events"
import { localeValuesFromL10n } from "../../lib/translations"
import { syncTranslationsWorkflow } from "../translations/sync-translations"
import {
  upsertAttributeOptionStep,
  UpsertAttributeOptionInput,
  validateUpsertAttributeOptionStep,
} from "./steps/attribute-option"

export type { UpsertAttributeOptionInput } from "./steps/attribute-option"

/**
 * Creates (no `id`) or updates an option of a select/multiselect attribute,
 * syncs its label and title_label translations and emits
 * `attribute-option.updated`.
 */
export const upsertAttributeOptionWorkflow = createWorkflow(
  "upsert-attribute-option",
  (input: UpsertAttributeOptionInput) => {
    const checked = validateUpsertAttributeOptionStep(input)
    const stepInput = transform({ input, checked }, ({ input, checked }) => ({
      ...input,
      next_rank: checked.next_rank,
    }))
    const option = upsertAttributeOptionStep(stepInput)

    const translations = transform({ input, option }, ({ input, option }) => ({
      reference: "attribute_option",
      items: [
        {
          reference_id: option.id,
          values: localeValuesFromL10n({ label: input.label, title_label: input.title_label }),
        },
      ],
    }))
    syncTranslationsWorkflow.runAsStep({ input: translations })

    const eventData = transform({ option }, ({ option }) => ({ id: option.id }))
    emitEventStep({ eventName: ATTRIBUTE_OPTION_UPDATED, data: eventData })

    return new WorkflowResponse(option)
  }
)
