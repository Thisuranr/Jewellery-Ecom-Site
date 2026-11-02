import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { ATTRIBUTE_DEFINITION_UPDATED } from "../../lib/events"
import { localeValuesFromL10n } from "../../lib/translations"
import { syncTranslationsWorkflow } from "../translations/sync-translations"
import {
  createAttributeDefinitionStep,
  createAttributeOptionsStep,
  CreateAttributeInput,
  validateCreateAttributeStep,
} from "./steps/attribute-definition"

export type { CreateAttributeInput, OptionInput, TitleL10n } from "./steps/attribute-definition"

/**
 * Creates an attribute definition with its options, and their si-LK / ta-LK
 * `label` and `title_label` translations. Fails with `handle_taken` when the
 * handle exists. Emits `attribute-definition.updated` (M2 B1).
 */
export const createAttributeWorkflow = createWorkflow(
  "create-attribute",
  (input: CreateAttributeInput) => {
    validateCreateAttributeStep(input)
    const definition = createAttributeDefinitionStep(input)

    const optionsInput = transform({ input, definition }, ({ input, definition }) => ({
      attribute_id: definition.id,
      options: input.options ?? [],
    }))
    const options = createAttributeOptionsStep(optionsInput)

    const translations = transform(
      { input, definition, options },
      ({ input, definition, options }) => {
        const optionInputByHandle = new Map((input.options ?? []).map((o) => [o.handle, o]))
        return {
          reference: "attribute_definition",
          items: [
            {
              reference_id: definition.id,
              values: localeValuesFromL10n({ label: input.label }),
            },
            ...options.map((option) => {
              const source = optionInputByHandle.get(option.handle)!
              return {
                reference: "attribute_option",
                reference_id: option.id,
                values: localeValuesFromL10n({
                  label: source.label,
                  title_label: source.title_label ?? undefined,
                }),
              }
            }),
          ],
        }
      }
    )
    syncTranslationsWorkflow.runAsStep({ input: translations })

    const eventData = transform({ definition }, ({ definition }) => ({ id: definition.id }))
    emitEventStep({ eventName: ATTRIBUTE_DEFINITION_UPDATED, data: eventData })

    const result = transform({ definition, options }, ({ definition, options }) => ({
      id: definition.id,
      options,
    }))
    return new WorkflowResponse(result)
  }
)
