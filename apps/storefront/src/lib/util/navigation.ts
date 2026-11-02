// Client-safe navigation types and URL helpers (no server-only imports).

export type NavChild = { id: string; name: string; handle: string }
export type NavCategory = NavChild & { children: NavChild[] }
export type NavFilterLink = { label: string; value: string }

export type Navigation = {
  categories: NavCategory[]
  materials: NavFilterLink[]
  colours: NavFilterLink[]
}

/** `product[refinementList][attr][0]=material_type:gold_plated`, the store listing's URL state. */
export const attrQuery = (value: string) =>
  `product[refinementList][attr][0]=${value}`

/** Newest-first sort, as the listing encodes it in the URL. */
export const NEWEST_QUERY = "product[sortBy]=product/sort/created_at:desc"
