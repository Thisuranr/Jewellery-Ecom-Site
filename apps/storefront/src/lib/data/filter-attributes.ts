import { sdk } from "@lib/config"
import { listCategories } from "./categories"
import type { FilterAttribute } from "@lib/util/filter-attributes"
import { getCacheOptions } from "./cookies"


type StoreFilterAttribute = {
  handle: string
  label: string
  type: string
  rank: number
  facet: { field: string; kind: string }
  options: { handle: string; label: string; value: string }[]
}

const toFilterAttribute = (
  attribute: StoreFilterAttribute
): FilterAttribute | null => {
  if (attribute.facet?.kind !== "value") {
    return null
  }

  // A boolean has no options on the route: it is Yes (true) or No (false).
  const options =
    attribute.type === "boolean"
      ? [
          { label: "Yes", value: `${attribute.handle}:true` },
          { label: "No", value: `${attribute.handle}:false` },
        ]
      : attribute.options.map(({ label, value }) => ({ label, value }))

  return options.length
    ? {
        handle: attribute.handle,
        label: attribute.label,
        rank: attribute.rank,
        options,
      }
    : null
}

/**
 * The filterable attributes of one category and its ancestors, with their
 * options (`GET /store/product-categories/:id/attributes`). A failure returns
 * none, so the listing still works without attribute filters.
 */
export const listCategoryFilterAttributes = async (
  categoryId: string
): Promise<FilterAttribute[]> => {
  const next = { ...(await getCacheOptions("categories")) }

  return sdk.client
    .fetch<{ attributes: StoreFilterAttribute[] }>(
      `/store/product-categories/${categoryId}/attributes`,
      { method: "GET", next, cache: "force-cache" }
    )
    .then(({ attributes }) =>
      (attributes ?? [])
        .map(toFilterAttribute)
        .filter((attribute): attribute is FilterAttribute => !!attribute)
    )
    .catch(() => [])
}

/** Every category's filterable attributes, merged by handle (all-products page). */
export const listAllFilterAttributes = async (): Promise<FilterAttribute[]> => {
  const categories = await listCategories({ fields: "id", limit: 200 }).catch(
    () => []
  )
  const perCategory = await Promise.all(
    categories.map((category) => listCategoryFilterAttributes(category.id))
  )

  const merged = new Map<string, FilterAttribute>()
  for (const attribute of perCategory.flat()) {
    const existing = merged.get(attribute.handle)
    if (!existing) {
      merged.set(attribute.handle, { ...attribute })
      continue
    }
    existing.rank = Math.min(existing.rank, attribute.rank)
    const known = new Set(existing.options.map((option) => option.value))
    existing.options = [
      ...existing.options,
      ...attribute.options.filter((option) => !known.has(option.value)),
    ]
  }

  return Array.from(merged.values()).sort(
    (a, b) => a.rank - b.rank || a.label.localeCompare(b.label)
  )
}
