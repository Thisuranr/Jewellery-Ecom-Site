import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { L10n, L10nRead, TRANSLATED_LOCALES, TranslatedLocale } from "./locales"

/**
 * Values to write for one entity, per translated locale. A string sets the
 * field, `""` (after trimming) or `null` removes it, and a field or locale
 * that is not present is left as it is.
 */
export type LocaleValues = Partial<
  Record<TranslatedLocale, Record<string, string | null | undefined>>
>

export type DesiredTranslation = {
  /** Defaults to the call's `reference`. */
  reference?: string
  reference_id: string
  values: LocaleValues
}

/** A translation row as the translation module returns it. */
export type ExistingTranslation = {
  id: string
  reference: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown> | null
}

export type TranslationCreate = {
  reference: string
  reference_id: string
  locale_code: string
  translations: Record<string, string>
}

export type TranslationUpdate = {
  id: string
  translations: Record<string, unknown>
}

export type TranslationBatchPlan = {
  create: TranslationCreate[]
  update: TranslationUpdate[]
  delete: string[]
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

/**
 * Plans the translation writes that bring the stored si-LK / ta-LK rows to the
 * desired values (pure). English is never written: only TRANSLATED_LOCALES are
 * read from `values`, and only the listed `fields`.
 *
 * The translation module merges the `translations` JSON on update (MikroORM
 * `mergeObjectProperties`), so a removed field is written as `null`; an update
 * sends the row's full object, so the result is the same under replace
 * semantics. A row left with no non-empty field is deleted.
 */
export function planTranslationBatch(input: {
  reference: string
  fields: string[]
  existing: ExistingTranslation[]
  desired: DesiredTranslation[]
}): TranslationBatchPlan {
  const allowed = new Set(input.fields)
  const byKey = new Map<string, ExistingTranslation>()
  for (const row of input.existing) {
    byKey.set(`${row.reference}\u0000${row.reference_id}\u0000${row.locale_code}`, row)
  }

  const plan: TranslationBatchPlan = { create: [], update: [], delete: [] }

  for (const item of input.desired) {
    const reference = item.reference ?? input.reference
    for (const locale of TRANSLATED_LOCALES) {
      const wanted = item.values?.[locale]
      if (!wanted || typeof wanted !== "object") {
        continue
      }
      const changes = new Map<string, string | null>()
      for (const [field, value] of Object.entries(wanted)) {
        if (!allowed.has(field) || value === undefined) {
          continue
        }
        changes.set(field, cleanText(value))
      }
      if (!changes.size) {
        continue
      }

      const existing = byKey.get(`${reference}\u0000${item.reference_id}\u0000${locale}`)
      if (!existing) {
        const translations: Record<string, string> = {}
        for (const [field, value] of changes) {
          if (value !== null) {
            translations[field] = value
          }
        }
        if (Object.keys(translations).length) {
          plan.create.push({
            reference,
            reference_id: item.reference_id,
            locale_code: locale,
            translations,
          })
        }
        continue
      }

      const current = existing.translations ?? {}
      const next: Record<string, unknown> = { ...current }
      let changed = false
      for (const [field, value] of changes) {
        if (cleanText(current[field]) !== value) {
          changed = true
        }
        next[field] = value
      }
      if (!changed) {
        continue
      }
      const hasAny = Object.values(next).some((value) => cleanText(value) !== null)
      if (hasAny) {
        plan.update.push({ id: existing.id, translations: next })
      } else {
        plan.delete.push(existing.id)
      }
    }
  }

  return plan
}

/**
 * Turns L10n inputs into per-locale values for planTranslationBatch. A `null`
 * L10n removes the field in both locales; `undefined` leaves it untouched.
 */
export function localeValuesFromL10n(
  fields: Record<string, { en?: string | null; si?: string | null; ta?: string | null } | null | undefined>
): Required<LocaleValues> {
  const values: Required<LocaleValues> = { "si-LK": {}, "ta-LK": {} }
  for (const [field, l10n] of Object.entries(fields)) {
    if (l10n === undefined) {
      continue
    }
    if (l10n === null) {
      values["si-LK"][field] = null
      values["ta-LK"][field] = null
      continue
    }
    if (l10n.si !== undefined) {
      values["si-LK"][field] = l10n.si
    }
    if (l10n.ta !== undefined) {
      values["ta-LK"][field] = l10n.ta
    }
  }
  return values
}

type GraphQuery = Pick<RemoteQueryFunction, "graph">

const ID_BATCH = 500

/**
 * Reads `fields` of `ids` in all three languages: English from the entity
 * (`reference` is its query.graph entity name, which is also the translation
 * reference) and si/ta from the translation rows. Reads the rows directly,
 * because `query.graph(..., { locale })` only applies a translation whose type
 * matches the base value, so a field that is null in English would never be
 * translated (plan fact 6). An empty translation reads as null.
 */
export async function loadLocalized(
  query: GraphQuery,
  reference: string,
  ids: string[],
  fields: string[]
): Promise<Record<string, Record<string, L10nRead>>> {
  const unique = [...new Set(ids)]
  const result: Record<string, Record<string, L10nRead>> = {}
  if (!unique.length) {
    return result
  }

  for (let i = 0; i < unique.length; i += ID_BATCH) {
    const batch = unique.slice(i, i + ID_BATCH)
    const { data: entities } = await query.graph({
      entity: reference,
      fields: ["id", ...fields],
      filters: { id: batch },
    })
    const { data: rows } = await query.graph({
      entity: "translations",
      fields: ["reference_id", "locale_code", "translations"],
      filters: {
        reference,
        reference_id: batch,
        locale_code: [...TRANSLATED_LOCALES],
      },
    })

    const byLocale = new Map<string, Record<string, unknown>>()
    for (const row of rows as Array<{
      reference_id: string
      locale_code: string
      translations: Record<string, unknown> | null
    }>) {
      byLocale.set(`${row.reference_id}\u0000${row.locale_code}`, row.translations ?? {})
    }

    for (const entity of entities as Array<Record<string, unknown> & { id: string }>) {
      const si = byLocale.get(`${entity.id}\u0000si-LK`) ?? {}
      const ta = byLocale.get(`${entity.id}\u0000ta-LK`) ?? {}
      const localized: Record<string, L10nRead> = {}
      for (const field of fields) {
        const en = entity[field]
        localized[field] = {
          en: typeof en === "string" ? en : null,
          si: cleanText(si[field]),
          ta: cleanText(ta[field]),
        }
      }
      result[entity.id] = localized
    }
  }

  return result
}
