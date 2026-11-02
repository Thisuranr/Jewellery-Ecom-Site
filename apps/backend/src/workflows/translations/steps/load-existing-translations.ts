import type { ITranslationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TRANSLATED_LOCALES } from "../../../lib/locales"
import type { ExistingTranslation } from "../../../lib/translations"

export type LoadExistingTranslationsStepInput = {
  reference_ids: string[]
}

/** Reads the si-LK / ta-LK translation rows of the given entities. Writes nothing. */
export const loadExistingTranslationsStep = createStep(
  "load-existing-translations",
  async (input: LoadExistingTranslationsStepInput, { container }) => {
    const ids = [...new Set(input.reference_ids)]
    if (!ids.length) {
      return new StepResponse([] as ExistingTranslation[])
    }
    const translation: ITranslationModuleService = container.resolve(Modules.TRANSLATION)
    const rows = await translation.listTranslations(
      { reference_id: ids, locale_code: [...TRANSLATED_LOCALES] },
      { select: ["id", "reference", "reference_id", "locale_code", "translations"] }
    )
    const existing: ExistingTranslation[] = rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      reference_id: row.reference_id,
      locale_code: row.locale_code,
      translations: (row.translations as Record<string, unknown> | null) ?? null,
    }))
    return new StepResponse(existing)
  }
)
