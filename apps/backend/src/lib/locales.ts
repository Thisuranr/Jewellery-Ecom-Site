import { z } from "@medusajs/framework/zod"

/**
 * Every locale the store serves. This project is English only (Australia), so
 * there are no translation rows to write: TRANSLATED_LOCALES is empty and the
 * translation helpers become no-ops. To add a language, add its code to both
 * lists (and to TranslatedLocale) and restore the extra inputs in the admin.
 */
export const STORE_LOCALES = ["en-AU"] as const
/** Locales held in translation rows. English is never written there. */
export const TRANSLATED_LOCALES: readonly TranslatedLocale[] = []

export type StoreLocale = (typeof STORE_LOCALES)[number]
/** Kept as a type so the translation helpers stay generic; nothing is stored for it. */
export type TranslatedLocale = "si-LK" | "ta-LK"

export const SHORT_LOCALE = {
  en: "en-AU",
} as const satisfies Record<string, StoreLocale>

export type ShortLocale = keyof typeof SHORT_LOCALE

/**
 * Text as the admin API sends it. `en` is the entity's own field. `si` and
 * `ta` are kept in the type for API-shape compatibility but the schema rejects
 * them (English only), so they are always undefined.
 */
export type L10n = { en: string; si?: string | null; ta?: string | null }

/** The same text as read back: every locale present, `null` when unset. */
export type L10nRead = { en: string | null; si: string | null; ta: string | null }

/** zod schema for an L10n input: `en` required (1 to `max` characters). English only. */
export function l10nSchema(max: number) {
  return z
    .object({
      en: z.string().trim().min(1).max(max),
    })
    .strict()
}
