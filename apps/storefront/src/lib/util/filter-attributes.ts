/** The search index field that holds `handle:value` keywords (backend src/search). */
export const ATTR_FIELD = "attr"

export type FilterOption = {
  label: string
  /** The `attr` keyword, e.g. "material_type:gold_plated". */
  value: string
}

export type FilterAttribute = {
  handle: string
  label: string
  rank: number
  options: FilterOption[]
}
