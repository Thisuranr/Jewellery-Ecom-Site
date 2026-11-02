/**
 * Attribute inheritance over the category tree (plan M1, "Inheritance"). Pure.
 *
 * - A category's attributes are the links on it and on every ancestor in its
 *   `mpath`.
 * - When several levels link the same attribute, the nearest link wins: it
 *   sets `rank`, and the attribute is required if
 *   `required_override ?? definition.required`.
 * - A product gets the union over its categories: required if any category
 *   requires it, with the lowest rank (and that link's source category).
 */

export type CategoryNode = { id: string; mpath?: string | null }

export type CategoryLink = {
  category_id: string
  attribute_id: string
  rank: number
  required_override: boolean | null
}

export type DefinitionForInheritance = {
  id: string
  required: boolean
  /** Tie-breakers for equal link ranks. */
  rank?: number
  handle?: string
}

export type EffectiveAttribute = {
  attribute_id: string
  required: boolean
  rank: number
  /** The category whose link applies. */
  source_category_id: string
}

/**
 * The ids in a category's `mpath` (root first, joined by "."), nearest first:
 * the category itself, its parent, and so on up to the root.
 */
export function ancestorsFromMpath(mpath: string | null | undefined): string[] {
  if (!mpath) {
    return []
  }
  return mpath
    .split(".")
    .filter((id) => id.length > 0)
    .reverse()
}

/** The attributes of one category, nearest link per attribute. */
function effectiveForCategory(
  category: CategoryNode,
  linksByCategory: Map<string, CategoryLink[]>,
  definitions: Record<string, DefinitionForInheritance>
): Map<string, EffectiveAttribute> {
  const chain = ancestorsFromMpath(category.mpath)
  if (!chain.length) {
    chain.push(category.id)
  }
  const result = new Map<string, EffectiveAttribute>()
  for (const categoryId of chain) {
    for (const link of linksByCategory.get(categoryId) ?? []) {
      const definition = definitions[link.attribute_id]
      if (!definition || result.has(link.attribute_id)) {
        continue
      }
      result.set(link.attribute_id, {
        attribute_id: link.attribute_id,
        required: link.required_override ?? definition.required,
        rank: link.rank,
        source_category_id: link.category_id,
      })
    }
  }
  return result
}

/**
 * The effective attributes of a product in `categoryIds`, sorted by rank.
 * Unknown category ids and links to unknown attributes are ignored.
 */
export function effectiveForCategories(
  categoryIds: string[],
  categoriesById: Record<string, CategoryNode>,
  links: CategoryLink[],
  definitions: Record<string, DefinitionForInheritance>
): EffectiveAttribute[] {
  const linksByCategory = new Map<string, CategoryLink[]>()
  for (const link of links) {
    const list = linksByCategory.get(link.category_id) ?? []
    list.push(link)
    linksByCategory.set(link.category_id, list)
  }

  const merged = new Map<string, EffectiveAttribute>()
  for (const categoryId of new Set(categoryIds)) {
    const category = categoriesById[categoryId]
    if (!category) {
      continue
    }
    for (const entry of effectiveForCategory(category, linksByCategory, definitions).values()) {
      const current = merged.get(entry.attribute_id)
      if (!current) {
        merged.set(entry.attribute_id, { ...entry })
        continue
      }
      current.required = current.required || entry.required
      if (entry.rank < current.rank) {
        current.rank = entry.rank
        current.source_category_id = entry.source_category_id
      }
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank
    }
    const da = definitions[a.attribute_id]
    const db = definitions[b.attribute_id]
    const rankDiff = (da.rank ?? 0) - (db.rank ?? 0)
    if (rankDiff !== 0) {
      return rankDiff
    }
    return (da.handle ?? a.attribute_id).localeCompare(db.handle ?? b.attribute_id)
  })
}
