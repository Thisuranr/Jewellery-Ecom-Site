import { emailError, EMAIL_ERROR } from "../lib/errors"

// Helpers the M4 order and staff templates share to read `notification.data`. The data is
// written by our own workflows, but its shape is still checked (a template throws
// `invalid_template_data`, which Medusa records as a failed notification), every text is
// normalised to NFC, and only the fields a template names are read: anything else in
// `data` (a name, phone number or card detail that should never be there) is dropped.

export const MAX_TEXT = 300
const MAX_URL = 2048
const MAX_ROWS = 200

export type Obj = Record<string, unknown>

export function asObject(value: unknown): Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {}
}

function bad(template: string, field: string): never {
  throw emailError(EMAIL_ERROR.invalidTemplateData, `${template} needs ${field}`)
}

/** A required, non-blank text of at most `max` characters, NFC, trimmed. */
export function reqText(template: string, obj: Obj, field: string, max = MAX_TEXT): string {
  const value = obj[field]
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    return bad(template, field)
  }
  return value.trim().normalize("NFC")
}

/** An optional text: absent, blank or too long gives undefined; a non-string is invalid. */
export function optText(template: string, obj: Obj, field: string, max = MAX_TEXT): string | undefined {
  const value = obj[field]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== "string" || value.length > max) {
    return bad(template, field)
  }
  return value.trim() ? value.trim().normalize("NFC") : undefined
}

/** A required number (integer or a numeric string of digits is accepted for ids and counts). */
export function reqInt(template: string, obj: Obj, field: string): number {
  const value = obj[field]
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000_000) {
    return bad(template, field)
  }
  return value
}

/** A required http(s) address; `httpsOnly` refuses plain http (fix batch 5a: tracking links). */
export function reqUrl(template: string, obj: Obj, field: string, options: { httpsOnly?: boolean } = {}): string {
  const value = obj[field]
  if (typeof value !== "string" || !value || value.length > MAX_URL || /\s/u.test(value)) {
    return bad(template, field)
  }
  try {
    const url = new URL(value)
    if (url.protocol === "https:" || (url.protocol === "http:" && !options.httpsOnly)) {
      return value
    }
  } catch {
    // falls through
  }
  return bad(template, field)
}

/** An optional http(s) address: absent or null gives undefined; anything else must be a valid address. */
export function optUrl(template: string, obj: Obj, field: string, options: { httpsOnly?: boolean } = {}): string | undefined {
  return obj[field] === undefined || obj[field] === null ? undefined : reqUrl(template, obj, field, options)
}

export function reqArray(template: string, obj: Obj, field: string, max = MAX_ROWS): Obj[] {
  const value = obj[field]
  if (!Array.isArray(value) || value.length > max) {
    return bad(template, field)
  }
  return value.map(asObject)
}

export function optArray(template: string, obj: Obj, field: string, max = MAX_ROWS): Obj[] {
  return obj[field] === undefined || obj[field] === null ? [] : reqArray(template, obj, field, max)
}

/** An optional list of short texts (address lines): blanks dropped, at most `max` lines of `maxLen` characters. */
export function optStringList(template: string, obj: Obj, field: string, max = 10, maxLen = MAX_TEXT): string[] {
  const value = obj[field]
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value) || value.length > max) {
    return bad(template, field)
  }
  return value.map((line) => {
    if (typeof line !== "string" || line.length > maxLen) {
      return bad(template, field)
    }
    return line.trim().normalize("NFC")
  }).filter(Boolean)
}
