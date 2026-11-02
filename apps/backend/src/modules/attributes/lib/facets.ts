import type { AttributeType } from "../models/attribute-definition"

/**
 * Handles that get a numeric range field in the product search index (plan M1,
 * decision 4). Index schemas are static, so a new range filter needs a code
 * change here and in the index definition, then a reindex.
 */
export const NUMERIC_FACET_HANDLES = [
  "length_m",
  "ram_gb",
  "storage_gb",
  "screen_in",
  "warranty_months",
] as const

export type NumericFacetHandle = (typeof NUMERIC_FACET_HANDLES)[number]

/** The index field that holds a numeric attribute, or null (e.g. `n_length_m`). */
export function numericFacetField(handle: string): string | null {
  return (NUMERIC_FACET_HANDLES as readonly string[]).includes(handle) ? `n_${handle}` : null
}

/**
 * How the storefront filters on an attribute (plan B5, review finding 5).
 * - `value`: facet and filter on the `attr` keyword field. A value is
 *   `"<prefix><option handle>"`, `"<prefix>true"` / `"<prefix>false"` or
 *   `"<prefix><number>"`. Ask the search API for `{ field: "attr", query:
 *   prefix, limit: 100 }` to list only this attribute's values.
 * - `range`: a numeric field filtered with a range and shown with a stats facet.
 */
export type AttributeFacet =
  | { field: "attr"; kind: "value"; prefix: string }
  | { field: string; kind: "range" }

/** The facet of a filterable attribute, or null for a type that can't be filtered (text). */
export function facetFor(handle: string, type: AttributeType): AttributeFacet | null {
  if (type === "text") {
    return null
  }
  if (type === "number") {
    const field = numericFacetField(handle)
    if (field) {
      return { field, kind: "range" }
    }
  }
  return { field: "attr", kind: "value", prefix: `${handle}:` }
}
