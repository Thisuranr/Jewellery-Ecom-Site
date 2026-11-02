export type CategorySummary = {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
}

/** "Women's workwear > Sarees" for every category id (a parent loop is cut short). */
export function categoryPaths(categories: CategorySummary[]): Map<string, string> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const paths = new Map<string, string>()
  for (const category of categories) {
    const names = [category.name]
    let parent = category.parent_category_id ? byId.get(category.parent_category_id) : undefined
    let guard = 0
    while (parent && guard++ < 10) {
      names.unshift(parent.name)
      parent = parent.parent_category_id ? byId.get(parent.parent_category_id) : undefined
    }
    paths.set(category.id, names.join(" > "))
  }
  return paths
}
