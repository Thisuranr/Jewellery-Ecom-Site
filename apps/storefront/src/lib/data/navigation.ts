import { HttpTypes } from "@medusajs/types"

import { listAllFilterAttributes } from "./filter-attributes"
import { listCategories } from "./categories"
import type {
  NavChild,
  NavFilterLink,
  Navigation,
} from "@lib/util/navigation"


// Which attribute options the menus advertise, and the attribute they belong to.
// Labels come from the backend when it has them; the handles are the shop-by choices.
const MATERIALS = {
  attribute: "material_type",
  options: [
    ["gold_plated", "Gold plated"],
    ["sterling_silver", "Sterling silver"],
    ["solid_gold", "Solid gold"],
  ],
} as const
const COLOURS = {
  attribute: "metal_colour",
  options: [
    ["yellow", "Yellow"],
    ["white", "White"],
    ["rose", "Rose"],
  ],
} as const

const byRank = (
  a: { rank?: number | null; name: string },
  b: { rank?: number | null; name: string }
) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name)

const toChild = (c: HttpTypes.StoreProductCategory): NavChild => ({
  id: c.id,
  name: c.name,
  handle: c.handle,
})


/**
 * Top-level categories (rank order) with their children, plus the "shop by"
 * filter choices. Everything is read from the backend so admin edits show up.
 */
export const getNavigation = async (): Promise<Navigation> => {
  const [all, attributes] = await Promise.all([
    listCategories({
      fields:
        "id,name,handle,rank,parent_category_id,category_children.id,category_children.name,category_children.handle,category_children.rank",
      limit: 200,
    }).catch(() => [] as HttpTypes.StoreProductCategory[]),
    listAllFilterAttributes().catch(() => []),
  ])

  const categories = all
    .filter((c) => !c.parent_category_id)
    .sort(byRank)
    .map((c) => ({
      ...toChild(c),
      children: (c.category_children ?? [])
        .slice()
        .sort(byRank)
        .map(toChild),
    }))

  const links = (def: typeof MATERIALS | typeof COLOURS): NavFilterLink[] => {
    const attribute = attributes.find((a) => a.handle === def.attribute)
    return def.options.map(([handle, fallback]) => {
      const value = `${def.attribute}:${handle}`
      const option = attribute?.options.find((o) => o.value === value)
      return { value, label: option?.label ?? fallback }
    })
  }

  return {
    categories,
    materials: links(MATERIALS),
    colours: links(COLOURS),
  }
}
