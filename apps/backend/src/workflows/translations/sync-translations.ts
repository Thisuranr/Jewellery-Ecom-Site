import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { batchTranslationsWorkflow } from "@medusajs/medusa/core-flows"
import {
  LocaleValues,
  planTranslationBatch,
  TranslationBatchPlan,
} from "../../lib/translations"
import { loadExistingTranslationsStep } from "./steps/load-existing-translations"

export type SyncTranslationsWorkflowInput = {
  /** The model's snake_case name, for example "attribute_option". */
  reference: string
  items: {
    /** Overrides `reference` for this item. */
    reference?: string
    reference_id: string
    values: LocaleValues
  }[]
}

export type SyncTranslationsWorkflowOutput = {
  created: number
  updated: number
  deleted: number
}

/**
 * Brings the si-LK / ta-LK translation rows of some entities to the given
 * values (see planTranslationBatch for the value rules). English is never
 * written. Runs Medusa's batchTranslationsWorkflow, so the writes emit the
 * usual translation.* events and are compensated when an outer workflow fails.
 */
export const syncTranslationsWorkflow = createWorkflow(
  "sync-translations",
  (input: SyncTranslationsWorkflowInput) => {
    const referenceIds = transform({ input }, ({ input }) => {
      return (input.items ?? []).map((item) => item.reference_id)
    })

    const existing = loadExistingTranslationsStep({ reference_ids: referenceIds })

    const plan = transform({ input, existing }, ({ input, existing }): TranslationBatchPlan => {
      const fields = new Set<string>()
      for (const item of input.items ?? []) {
        for (const values of Object.values(item.values ?? {})) {
          for (const field of Object.keys(values ?? {})) {
            fields.add(field)
          }
        }
      }
      return planTranslationBatch({
        reference: input.reference,
        fields: [...fields],
        existing,
        desired: input.items ?? [],
      })
    })

    when("sync-translations-has-changes", { plan }, ({ plan }) => {
      return plan.create.length + plan.update.length + plan.delete.length > 0
    }).then(() => {
      batchTranslationsWorkflow.runAsStep({ input: plan })
    })

    const summary = transform({ plan }, ({ plan }): SyncTranslationsWorkflowOutput => {
      return {
        created: plan.create.length,
        updated: plan.update.length,
        deleted: plan.delete.length,
      }
    })

    return new WorkflowResponse(summary)
  }
)
