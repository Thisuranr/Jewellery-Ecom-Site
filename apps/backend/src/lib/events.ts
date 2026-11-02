/**
 * Custom events emitted by the attribute workflows. Nothing in this project
 * subscribes to the first three yet; they are kept so a search index or
 * storefront cache can hook in later.
 */

/** Payload `{ id: product_id }`: a product's attribute values changed. */
export const PRODUCT_ATTRIBUTES_UPDATED = "product-attributes.updated"

/** Payload `{ id }`: an attribute option was created or changed. */
export const ATTRIBUTE_OPTION_UPDATED = "attribute-option.updated"

/** Payload `{ id }`: an attribute definition was created, changed or deleted. */
export const ATTRIBUTE_DEFINITION_UPDATED = "attribute-definition.updated"

/**
 * The ids in an event payload: core workflows emit `{ id }`, one event per
 * entity, but a payload may also be a list of them.
 */
export function eventIds(data: unknown): string[] {
  const entries = Array.isArray(data) ? data : [data]
  const ids = entries
    .map((entry) => (entry as { id?: unknown } | null | undefined)?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  return [...new Set(ids)]
}
