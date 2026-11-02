import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { codedError } from "./coded-error"
import type { L10nRead } from "./locales"
import { loadLocalized } from "./translations"
import {
  CategoryLink,
  CategoryNode,
  EffectiveAttribute,
  effectiveForCategories,
} from "../modules/attributes/lib/effective-attributes"
import { resolveAttributes as resolveAttributesService } from "../workflows/attributes/steps/attribute-definition"
import { loadProductAttributeContext } from "../workflows/attributes/steps/product-attributes"

/**
 * Read models for the attributes admin API (plan M1 B4). Reads use the module
 * service for structure and `loadLocalized` for the three languages.
 */

type Resolver = { resolve: (key: string) => any }

export type OptionAdmin = {
  id: string
  handle: string
  rank: number
  swatch_hex: string | null
  label: L10nRead
  /** null when no language has a title label. */
  title_label: L10nRead | null
}

export type AttributeAdmin = {
  id: string
  handle: string
  type: string
  unit: string | null
  group_handle: string | null
  filterable: boolean
  required: boolean
  rank: number
  label: L10nRead
  options: OptionAdmin[]
  categories: { category_id: string; rank: number; required_override: boolean | null }[]
  /** Products that hold a value for this attribute. */
  value_count: number
}

export type EffectiveAttributeAdmin = AttributeAdmin & {
  required: boolean
  rank: number
  source_category_id: string
}

export type ProductAttributeValueAdmin = {
  option_ids: string[]
  value_number: number | null
  value_bool: boolean | null
  value_text: L10nRead | null
}

export type ProductAttributeAdmin = EffectiveAttributeAdmin & {
  value: ProductAttributeValueAdmin | null
}

type DefinitionRow = {
  id: string
  handle: string
  type: string
  /** The base (English) label. */
  label?: string | null
  unit?: string | null
  group_handle?: string | null
  filterable: boolean
  required: boolean
  rank: number
  options?: {
    id: string
    handle: string
    rank: number
    swatch_hex?: string | null
  }[]
  category_links?: {
    category_id: string
    rank: number
    required_override?: boolean | null
  }[]
}

const byRankThenHandle = <T extends { rank: number; handle: string }>(a: T, b: T) =>
  a.rank - b.rank || a.handle.localeCompare(b.handle)

/** How many products hold a value, per attribute (a product counts once). */
async function countProducts(
  container: Resolver,
  attributeIds: string[]
): Promise<Map<string, number>> {
  const attributes = resolveAttributesService(container)
  const products = new Map<string, Set<string>>()
  if (!attributeIds.length) {
    return new Map()
  }
  const add = (rows: { attribute_id: string; product_id: string }[]) => {
    for (const row of rows) {
      const set = products.get(row.attribute_id) ?? new Set<string>()
      set.add(row.product_id)
      products.set(row.attribute_id, set)
    }
  }
  add(
    await attributes.listProductAttributeValues(
      { attribute_id: attributeIds },
      { select: ["attribute_id", "product_id"] }
    )
  )
  add(
    await attributes.listProductAttributeOptions(
      { attribute_id: attributeIds },
      { select: ["attribute_id", "product_id"] }
    )
  )
  return new Map([...products].map(([id, set]) => [id, set.size]))
}

/** Turns definition rows (with `options` and `category_links` loaded) into AttributeAdmin. */
export async function hydrateAttributes(
  container: Resolver,
  rows: DefinitionRow[]
): Promise<AttributeAdmin[]> {
  if (!rows.length) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const attributeIds = rows.map((row) => row.id)
  const optionIds = rows.flatMap((row) => (row.options ?? []).map((option) => option.id))

  const labels = await loadLocalized(query, "attribute_definition", attributeIds, ["label"])
  const optionText = await loadLocalized(query, "attribute_option", optionIds, [
    "label",
    "title_label",
  ])
  const counts = await countProducts(container, attributeIds)

  return rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    type: row.type,
    unit: row.unit ?? null,
    group_handle: row.group_handle ?? null,
    filterable: row.filterable,
    required: row.required,
    rank: row.rank,
    label: labels[row.id]?.label ?? { en: null, si: null, ta: null },
    options: [...(row.options ?? [])].sort(byRankThenHandle).map((option) => {
      const text = optionText[option.id]
      const title = text?.title_label
      return {
        id: option.id,
        handle: option.handle,
        rank: option.rank,
        swatch_hex: option.swatch_hex ?? null,
        label: text?.label ?? { en: null, si: null, ta: null },
        title_label: title && (title.en || title.si || title.ta) ? title : null,
      }
    }),
    categories: [...(row.category_links ?? [])]
      .sort((a, b) => a.rank - b.rank || a.category_id.localeCompare(b.category_id))
      .map((link) => ({
        category_id: link.category_id,
        rank: link.rank,
        required_override: link.required_override ?? null,
      })),
    value_count: counts.get(row.id) ?? 0,
  }))
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)

/** `GET /admin/attributes`: a page of attributes, optionally matching `q` in handle or English label. */
export async function listAttributesAdmin(
  container: Resolver,
  input: { q?: string; limit: number; offset: number }
): Promise<{ attributes: AttributeAdmin[]; count: number }> {
  const attributes = resolveAttributesService(container)
  const q = input.q?.trim()
  const filters = q
    ? {
        $or: [
          { handle: { $ilike: `%${escapeLike(q)}%` } },
          { label: { $ilike: `%${escapeLike(q)}%` } },
        ],
      }
    : {}
  const [rows, count] = await attributes.listAndCountAttributeDefinitions(filters, {
    relations: ["options", "category_links"],
    order: { rank: "ASC", handle: "ASC" },
    skip: input.offset,
    take: input.limit,
  })
  return { attributes: await hydrateAttributes(container, rows as DefinitionRow[]), count }
}

/** One attribute, or null when it doesn't exist. */
export async function getAttributeAdmin(
  container: Resolver,
  id: string
): Promise<AttributeAdmin | null> {
  const rows = await resolveAttributesService(container).listAttributeDefinitions(
    { id },
    { relations: ["options", "category_links"], take: 1 }
  )
  const [attribute] = await hydrateAttributes(container, rows as DefinitionRow[])
  return attribute ?? null
}

/** Like getAttributeAdmin, but a missing attribute is a coded 404. */
export async function requireAttributeAdmin(
  container: Resolver,
  id: string
): Promise<AttributeAdmin> {
  const attribute = await getAttributeAdmin(container, id)
  if (!attribute) {
    throw codedError(MedusaError.Types.NOT_FOUND, "attribute_not_found", `Attribute ${id} not found`)
  }
  return attribute
}

/**
 * The attributes a set of categories gives (their own links and their
 * ancestors'), nearest link wins, merged across categories (plan B2).
 */
export async function loadEffectiveForCategoryNodes(
  container: Resolver,
  categories: CategoryNode[]
): Promise<{ effective: EffectiveAttribute[]; definitions: Record<string, DefinitionRow> }> {
  const attributes = resolveAttributesService(container)
  const chainIds = new Set<string>()
  for (const category of categories) {
    for (const id of (category.mpath ?? category.id).split(".")) {
      if (id) {
        chainIds.add(id)
      }
    }
  }
  const links: CategoryLink[] = chainIds.size
    ? (
        await attributes.listCategoryAttributes(
          { category_id: [...chainIds] },
          { select: ["category_id", "attribute_id", "rank", "required_override"] }
        )
      ).map((link) => ({
        category_id: link.category_id,
        attribute_id: link.attribute_id,
        rank: link.rank,
        required_override: link.required_override ?? null,
      }))
    : []
  const attributeIds = [...new Set(links.map((link) => link.attribute_id))]
  const rows = attributeIds.length
    ? ((await attributes.listAttributeDefinitions(
        { id: attributeIds },
        { relations: ["options", "category_links"] }
      )) as DefinitionRow[])
    : []
  const definitions: Record<string, DefinitionRow> = {}
  for (const row of rows) {
    definitions[row.id] = row
  }
  const byId: Record<string, CategoryNode> = {}
  for (const category of categories) {
    byId[category.id] = category
  }
  const effective = effectiveForCategories(
    categories.map((category) => category.id),
    byId,
    links,
    definitions
  )
  return { effective, definitions }
}

function withEffective(
  effective: EffectiveAttribute[],
  admin: Map<string, AttributeAdmin>
): EffectiveAttributeAdmin[] {
  const result: EffectiveAttributeAdmin[] = []
  for (const entry of effective) {
    const attribute = admin.get(entry.attribute_id)
    if (!attribute) {
      continue
    }
    result.push({
      ...attribute,
      required: entry.required,
      rank: entry.rank,
      source_category_id: entry.source_category_id,
    })
  }
  return result
}

/** `GET /admin/product-categories/:id/attributes`. A missing category is a coded 404. */
export async function loadCategoryAttributesAdmin(
  container: Resolver,
  categoryId: string
): Promise<EffectiveAttributeAdmin[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "mpath"],
    filters: { id: categoryId },
  })
  const category = data[0] as CategoryNode | undefined
  if (!category) {
    throw codedError(
      MedusaError.Types.NOT_FOUND,
      "category_not_found",
      `Category ${categoryId} not found`
    )
  }
  const { effective, definitions } = await loadEffectiveForCategoryNodes(container, [category])
  const hydrated = await hydrateAttributes(container, Object.values(definitions))
  return withEffective(effective, new Map(hydrated.map((attribute) => [attribute.id, attribute])))
}

/**
 * `GET /admin/products/:id/attributes`: the product's effective attributes,
 * each with its current value. Values of attributes outside the effective set
 * are not returned (review finding 9). A missing product is a coded 404.
 */
export async function loadProductAttributesAdmin(
  container: Resolver,
  productId: string
): Promise<{ attributes: ProductAttributeAdmin[]; search_keywords: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const context = await loadProductAttributeContext(container, productId)
  const attributes = resolveAttributesService(container)

  const rows = context.effective.length
    ? ((await attributes.listAttributeDefinitions(
        { id: context.effective.map((entry) => entry.attribute_id) },
        { relations: ["options", "category_links"] }
      )) as DefinitionRow[])
    : []
  const hydrated = await hydrateAttributes(container, rows)
  const admin = new Map(hydrated.map((attribute) => [attribute.id, attribute]))

  const valueTexts = await loadLocalized(
    query,
    "product_attribute_value",
    context.existing_values.map((row) => row.id),
    ["value_text"]
  )
  const valueByAttribute = new Map(context.existing_values.map((row) => [row.attribute_id, row]))
  const optionsByAttribute = new Map<string, string[]>()
  for (const row of context.existing_options) {
    const list = optionsByAttribute.get(row.attribute_id) ?? []
    list.push(row.option_id)
    optionsByAttribute.set(row.attribute_id, list)
  }

  const result: ProductAttributeAdmin[] = withEffective(context.effective, admin).map((entry) => {
    const row = valueByAttribute.get(entry.id)
    const optionIds = optionsByAttribute.get(entry.id) ?? []
    let value: ProductAttributeValueAdmin | null = null
    if (row || optionIds.length) {
      const order = new Map(entry.options.map((option, index) => [option.id, index]))
      value = {
        option_ids: [...optionIds].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
        value_number: row?.value_number ?? null,
        value_bool: row?.value_bool ?? null,
        value_text:
          row && row.value_text !== null ? (valueTexts[row.id]?.value_text ?? null) : null,
      }
    }
    return { ...entry, value }
  })

  const keywords = context.metadata.search_keywords
  return { attributes: result, search_keywords: typeof keywords === "string" ? keywords : "" }
}
