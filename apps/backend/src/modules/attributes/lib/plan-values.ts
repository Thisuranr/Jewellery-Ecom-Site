import type { L10n } from "../../../lib/locales"
import type { LocaleValues } from "../../../lib/translations"
import type { AttributeType } from "../models/attribute-definition"
import type { EffectiveAttribute } from "./effective-attributes"

/**
 * Plans the writes that bring a product's attribute rows to `input` (pure,
 * plan M1 B2). Rows are diffed, never replaced, because value_text
 * translations are keyed by the row id (decision 8).
 */

export const MAX_ATTRIBUTE_NUMBER = 1_000_000
export const MAX_ATTRIBUTE_TEXT = 500

export const ATTRIBUTE_VALUE_ERROR_CODES = [
  "unknown_attribute",
  "attribute_not_in_category",
  "duplicate_attribute",
  "invalid_option",
  "single_option_required",
  "invalid_number",
  "invalid_boolean",
  "text_too_long",
  "value_type_mismatch",
  "required_missing",
] as const

export type AttributeValueErrorCode = (typeof ATTRIBUTE_VALUE_ERROR_CODES)[number]

export type AttributeValueInput = {
  attribute_id: string
  option_ids?: string[] | null
  value_number?: number | null
  value_bool?: boolean | null
  value_text?: L10n | null
}

export type DefinitionForValues = {
  id: string
  handle: string
  type: AttributeType
  /** The English label, for messages; a blank or missing label falls back to the handle. */
  label?: string | null
}

export type OptionForValues = { id: string; attribute_id: string }

export type ExistingValueRow = {
  id: string
  attribute_id: string
  value_text: string | null
  value_number: number | null
  value_bool: boolean | null
}

export type ExistingOptionRow = {
  id: string
  attribute_id: string
  option_id: string
}

export type PlannedValue = {
  value_text: string | null
  value_number: number | null
  value_bool: boolean | null
}

export type PlanProductAttributesInput = {
  effective: EffectiveAttribute[]
  definitions: Record<string, DefinitionForValues>
  optionsById: Record<string, OptionForValues>
  existingValues: ExistingValueRow[]
  existingOptions: ExistingOptionRow[]
  input: AttributeValueInput[]
}

export type AttributeValueError = {
  code: AttributeValueErrorCode
  /** Attribute handles (the id when the attribute is unknown). */
  handles: string[]
  /** handle -> label, for the handles whose definition has a label. */
  labels?: Record<string, string>
}

export type TextTranslationPlan = {
  attribute_id: string
  /** The value row; null for a row this plan creates. */
  value_id: string | null
  /** si-LK / ta-LK `value_text`; null removes, a missing locale is left alone. */
  values: LocaleValues
}

export type ProductAttributePlan = {
  errors: AttributeValueError[]
  createValues: (PlannedValue & { attribute_id: string })[]
  updateValues: (PlannedValue & { id: string })[]
  deleteValueIds: string[]
  createOptions: { attribute_id: string; option_id: string }[]
  deleteOptionIds: string[]
  textTranslations: TextTranslationPlan[]
}

type Desired =
  | { kind: "value"; value: PlannedValue; translations: LocaleValues | null }
  | { kind: "options"; option_ids: string[] }

const present = (value: unknown) => value !== undefined && value !== null

function isValidNumber(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false
  }
  if (value < 0 || value > MAX_ATTRIBUTE_NUMBER) {
    return false
  }
  // At most 2 decimals: n / 100 is the nearest double to the decimal n/100.
  return Math.round(value * 100) / 100 === value
}

function textTooLong(text: L10n): boolean {
  return [text.en, text.si, text.ta].some(
    (value) => typeof value === "string" && value.trim().length > MAX_ATTRIBUTE_TEXT
  )
}

function translationValues(text: L10n): LocaleValues | null {
  const values: LocaleValues = {}
  if (text.si !== undefined) {
    values["si-LK"] = { value_text: text.si?.trim() ? text.si.trim() : null }
  }
  if (text.ta !== undefined) {
    values["ta-LK"] = { value_text: text.ta?.trim() ? text.ta.trim() : null }
  }
  return Object.keys(values).length ? values : null
}

const REMOVE_TEXT: LocaleValues = {
  "si-LK": { value_text: null },
  "ta-LK": { value_text: null },
}

function sameValue(row: ExistingValueRow, value: PlannedValue): boolean {
  return (
    (row.value_text ?? null) === value.value_text &&
    (row.value_number ?? null) === value.value_number &&
    (row.value_bool ?? null) === value.value_bool
  )
}

export function planProductAttributeChanges(
  input: PlanProductAttributesInput
): ProductAttributePlan {
  const { effective, definitions, optionsById } = input
  const effectiveIds = new Set(effective.map((e) => e.attribute_id))

  const errors = new Map<AttributeValueErrorCode, string[]>()
  const addError = (code: AttributeValueErrorCode, handle: string) => {
    const handles = errors.get(code) ?? []
    if (!handles.includes(handle)) {
      handles.push(handle)
    }
    errors.set(code, handles)
  }

  const seen = new Set<string>()
  const failed = new Set<string>()
  const desired = new Map<string, Desired>()

  for (const item of input.input ?? []) {
    const attributeId = typeof item?.attribute_id === "string" ? item.attribute_id : String(item?.attribute_id)
    const definition = definitions[attributeId]
    if (!definition) {
      addError("unknown_attribute", attributeId)
      continue
    }
    const handle = definition.handle
    if (seen.has(attributeId)) {
      addError("duplicate_attribute", handle)
      failed.add(attributeId)
      continue
    }
    seen.add(attributeId)
    if (!effectiveIds.has(attributeId)) {
      addError("attribute_not_in_category", handle)
      failed.add(attributeId)
      continue
    }

    const fail = (code: AttributeValueErrorCode) => {
      addError(code, handle)
      failed.add(attributeId)
    }

    const hasOptions = Array.isArray(item.option_ids) ? item.option_ids.length > 0 : present(item.option_ids)
    const hasNumber = present(item.value_number)
    const hasBool = present(item.value_bool)
    const hasText = present(item.value_text)

    switch (definition.type) {
      case "select":
      case "multiselect": {
        if (hasNumber || hasBool || hasText) {
          fail("value_type_mismatch")
          break
        }
        if (!present(item.option_ids)) {
          break
        }
        if (!Array.isArray(item.option_ids)) {
          fail("invalid_option")
          break
        }
        const optionIds = [...new Set(item.option_ids)]
        const invalid = optionIds.some(
          (id) => typeof id !== "string" || optionsById[id]?.attribute_id !== attributeId
        )
        if (invalid) {
          fail("invalid_option")
          break
        }
        if (definition.type === "select" && optionIds.length > 1) {
          fail("single_option_required")
          break
        }
        if (optionIds.length) {
          desired.set(attributeId, { kind: "options", option_ids: optionIds })
        }
        break
      }
      case "number": {
        if (hasOptions || hasBool || hasText) {
          fail("value_type_mismatch")
          break
        }
        if (!hasNumber) {
          break
        }
        if (!isValidNumber(item.value_number)) {
          fail("invalid_number")
          break
        }
        desired.set(attributeId, {
          kind: "value",
          value: { value_text: null, value_number: item.value_number, value_bool: null },
          translations: null,
        })
        break
      }
      case "boolean": {
        if (hasOptions || hasNumber || hasText) {
          fail("value_type_mismatch")
          break
        }
        if (!hasBool) {
          break
        }
        if (typeof item.value_bool !== "boolean") {
          fail("invalid_boolean")
          break
        }
        desired.set(attributeId, {
          kind: "value",
          value: { value_text: null, value_number: null, value_bool: item.value_bool },
          translations: null,
        })
        break
      }
      case "text": {
        if (hasOptions || hasNumber || hasBool) {
          fail("value_type_mismatch")
          break
        }
        if (!hasText) {
          break
        }
        const text = item.value_text as L10n
        if (typeof text !== "object" || typeof text.en !== "string") {
          fail("value_type_mismatch")
          break
        }
        if (textTooLong(text)) {
          fail("text_too_long")
          break
        }
        const en = text.en.trim()
        if (!en) {
          break
        }
        desired.set(attributeId, {
          kind: "value",
          value: { value_text: en, value_number: null, value_bool: null },
          translations: translationValues(text),
        })
        break
      }
    }
  }

  const missing = effective
    .filter((e) => e.required && !failed.has(e.attribute_id) && !desired.has(e.attribute_id))
    .map((e) => definitions[e.attribute_id]?.handle ?? e.attribute_id)
  for (const handle of missing) {
    addError("required_missing", handle)
  }

  const plan: ProductAttributePlan = {
    errors: [...errors.entries()].map(([code, handles]) => withLabels(code, handles, definitions)),
    createValues: [],
    updateValues: [],
    deleteValueIds: [],
    createOptions: [],
    deleteOptionIds: [],
    textTranslations: [],
  }
  if (plan.errors.length) {
    return plan
  }

  // Value rows: one per attribute. Extra rows for the same attribute (which the
  // unique index prevents) are deleted.
  const valueRowByAttribute = new Map<string, ExistingValueRow>()
  for (const row of input.existingValues) {
    if (valueRowByAttribute.has(row.attribute_id)) {
      plan.deleteValueIds.push(row.id)
      plan.textTranslations.push({ attribute_id: row.attribute_id, value_id: row.id, values: REMOVE_TEXT })
      continue
    }
    valueRowByAttribute.set(row.attribute_id, row)
  }

  for (const [attributeId, want] of desired) {
    if (want.kind !== "value") {
      continue
    }
    const row = valueRowByAttribute.get(attributeId)
    if (!row) {
      plan.createValues.push({ attribute_id: attributeId, ...want.value })
    } else if (!sameValue(row, want.value)) {
      plan.updateValues.push({ id: row.id, ...want.value })
    }
    if (want.translations) {
      plan.textTranslations.push({
        attribute_id: attributeId,
        value_id: row?.id ?? null,
        values: want.translations,
      })
    }
  }
  for (const [attributeId, row] of valueRowByAttribute) {
    if (desired.get(attributeId)?.kind !== "value") {
      plan.deleteValueIds.push(row.id)
      plan.textTranslations.push({ attribute_id: attributeId, value_id: row.id, values: REMOVE_TEXT })
    }
  }

  // Option rows: one per (attribute, option).
  const keptOptionKeys = new Set<string>()
  for (const row of input.existingOptions) {
    const want = desired.get(row.attribute_id)
    const key = `${row.attribute_id}\u0000${row.option_id}`
    if (want?.kind === "options" && want.option_ids.includes(row.option_id) && !keptOptionKeys.has(key)) {
      keptOptionKeys.add(key)
    } else {
      plan.deleteOptionIds.push(row.id)
    }
  }
  for (const [attributeId, want] of desired) {
    if (want.kind !== "options") {
      continue
    }
    for (const optionId of want.option_ids) {
      if (!keptOptionKeys.has(`${attributeId}\u0000${optionId}`)) {
        plan.createOptions.push({ attribute_id: attributeId, option_id: optionId })
      }
    }
  }

  return plan
}

function withLabels(
  code: AttributeValueErrorCode,
  handles: string[],
  definitions: Record<string, DefinitionForValues>
): AttributeValueError {
  const labels: Record<string, string> = {}
  for (const definition of Object.values(definitions)) {
    const label = definition.label?.trim()
    if (label && handles.includes(definition.handle)) {
      labels[definition.handle] = label
    }
  }
  return Object.keys(labels).length ? { code, handles, labels } : { code, handles }
}

/**
 * "<text>: Label A, Label B" for the first error, as the workflows throw it.
 * Each attribute is named by its label, or by its handle (the id for an unknown
 * attribute) when it has none.
 */
export function describeAttributeValueError(error: AttributeValueError): string {
  const text: Record<AttributeValueErrorCode, string> = {
    unknown_attribute: "Unknown attribute",
    attribute_not_in_category: "Attribute does not apply to the product's categories",
    duplicate_attribute: "Attribute sent more than once",
    invalid_option: "Option does not belong to the attribute",
    single_option_required: "Choose one option only",
    invalid_number: `Number must be between 0 and ${MAX_ATTRIBUTE_NUMBER} with at most 2 decimals`,
    invalid_boolean: "Value must be true or false",
    text_too_long: `Text is longer than ${MAX_ATTRIBUTE_TEXT} characters`,
    value_type_mismatch: "Value does not match the attribute type",
    required_missing: "Required attributes missing",
  }
  return `${text[error.code]}: ${error.handles.map((handle) => error.labels?.[handle] ?? handle).join(", ")}`
}
