import type { ITranslationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export type PurgeTranslationsStepInput = {
  reference_ids: string[]
}

type TranslationRow = {
  id: string
  reference: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown> | null
}

/**
 * Hard-deletes every translation row (any locale) of the given entities. For
 * rows whose entity is itself hard-deleted (G2 review finding 1), where a
 * soft-deleted translation could never be restored or reached again. The
 * compensation re-creates the rows with their ids.
 */
export const purgeTranslationsStep = createStep(
  "purge-translations",
  async (input: PurgeTranslationsStepInput, { container }) => {
    const ids = [...new Set(input.reference_ids ?? [])]
    if (!ids.length) {
      return new StepResponse({ deleted: 0 }, [] as TranslationRow[])
    }
    const translation: ITranslationModuleService = container.resolve(Modules.TRANSLATION)
    // Plain columns only, so the compensation can hand them back to create().
    const rows: TranslationRow[] = (
      await translation.listTranslations(
        { reference_id: ids },
        { select: ["id", "reference", "reference_id", "locale_code", "translations"] }
      )
    ).map((row) => ({
      id: row.id,
      reference: row.reference,
      reference_id: row.reference_id,
      locale_code: row.locale_code,
      translations: (row.translations as Record<string, unknown> | null) ?? null,
    }))
    if (rows.length) {
      await translation.deleteTranslations(rows.map((row) => row.id))
    }
    return new StepResponse({ deleted: rows.length }, rows)
  },
  async (rows, { container }) => {
    if (!rows?.length) {
      return
    }
    const translation: ITranslationModuleService = container.resolve(Modules.TRANSLATION)
    await translation.createTranslations(
      rows.map((row) => ({ ...row, translations: row.translations ?? {} })) as Parameters<
        ITranslationModuleService["createTranslations"]
      >[0]
    )
  }
)
