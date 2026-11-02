import { ATTRIBUTE_TYPES, AttributeType } from "../models/attribute-definition"

/** Definition handle: immutable, used in facet values ("fabric:cotton"). */
export const ATTRIBUTE_HANDLE_RE = /^[a-z][a-z0-9_]{1,39}$/
export const OPTION_HANDLE_RE = /^[a-z0-9][a-z0-9_]{0,39}$/
export const SWATCH_HEX_RE = /^#[0-9a-f]{6}$/
export const ATTRIBUTE_UNITS = ["mm", "cm", "m", "in", "g", "kg", "ct", "months", "days"] as const
export const ATTRIBUTE_LABEL_MAX = 100
export const OPTION_TYPES: readonly AttributeType[] = ["select", "multiselect"]

export type DefinitionCheckInput = {
  handle?: unknown
  type?: unknown
  unit?: unknown
  label_en?: unknown
}

export type OptionCheckInput = {
  handle?: unknown
  label_en?: unknown
  swatch_hex?: unknown
}

/**
 * Field checks shared by the attribute workflows, so seeds and scripts get
 * the same guard as the admin API. Returns "<code>: <text>" or null.
 */
export function checkDefinitionFields(
  input: DefinitionCheckInput,
  { creating }: { creating: boolean }
): string | null {
  if (creating || input.handle !== undefined) {
    if (typeof input.handle !== "string" || !ATTRIBUTE_HANDLE_RE.test(input.handle)) {
      return "invalid_handle: Handle must match ^[a-z][a-z0-9_]{1,39}$"
    }
  }
  if (creating || input.type !== undefined) {
    if (!(ATTRIBUTE_TYPES as readonly unknown[]).includes(input.type)) {
      return `invalid_type: Type must be one of ${ATTRIBUTE_TYPES.join(", ")}`
    }
  }
  if (input.unit !== undefined && input.unit !== null) {
    if (!(ATTRIBUTE_UNITS as readonly unknown[]).includes(input.unit)) {
      return `invalid_unit: Unit must be one of ${ATTRIBUTE_UNITS.join(", ")}`
    }
  }
  if (creating || input.label_en !== undefined) {
    if (!isLabel(input.label_en)) {
      return `label_required: An English label of 1 to ${ATTRIBUTE_LABEL_MAX} characters is required`
    }
  }
  return null
}

export function checkOptionFields(input: OptionCheckInput): string | null {
  if (typeof input.handle !== "string" || !OPTION_HANDLE_RE.test(input.handle)) {
    return "invalid_option_handle: Option handle must match ^[a-z0-9][a-z0-9_]{0,39}$"
  }
  if (!isLabel(input.label_en)) {
    return `label_required: Option ${input.handle} needs an English label of 1 to ${ATTRIBUTE_LABEL_MAX} characters`
  }
  if (input.swatch_hex !== undefined && input.swatch_hex !== null) {
    if (typeof input.swatch_hex !== "string" || !SWATCH_HEX_RE.test(input.swatch_hex)) {
      return `invalid_swatch: Swatch of ${input.handle} must match ^#[0-9a-f]{6}$`
    }
  }
  return null
}

function isLabel(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= ATTRIBUTE_LABEL_MAX
  )
}
