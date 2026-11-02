import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { codedError } from "./coded-error"
import { loadEffectiveForCategoryNodes } from "./attribute-read"
import { AttributeFacet, facetFor } from "../modules/attributes/lib/facets"
import type { CategoryNode } from "../modules/attributes/lib/effective-attributes"
import type { AttributeType } from "../modules/attributes/models/attribute-definition"
import { resolveAttributes } from "../workflows/attributes/steps/attribute-definition"
import { loadProductAttributeContext } from "../workflows/attributes/steps/product-attributes"

/**
 * Read models of the store attribute routes (plan M1 B5). Structure comes from
 * the attributes module; the text comes from query.graph(..., { locale }), so a
 * missing translation shows English. `title_label`, ids and the admin-only
 * flags are never returned.
 */

type Resolver = { resolve: (key: string) => any }

export type StoreFilterOption = {
  handle: string
  label: string
  swatch_hex: string | null
  /** The `attr` keyword value to filter on: "<attribute>:<option>". */
  value: string
}

export type StoreFilterAttribute = {
  handle: string
  label: string
  type: string
  unit: string | null
  group_handle: string | null
  rank: number
  facet: AttributeFacet
  options: StoreFilterOption[]
}

export type StoreSpecOption = { handle: string; label: string; swatch_hex: string | null }
export type StoreSpecValue = string | number | boolean | StoreSpecOption[]

export type StoreSpecGroup = {
  handle: string
  attributes: {
    handle: string
    label: string
    type: string
    unit: string | null
    value: StoreSpecValue
  }[]
}

/** The group handle of an attribute that has no `group_handle`. */
export const DEFAULT_GROUP_HANDLE = "other"

type TextEntity = { id: string } & Record<string, unknown>

/** Reads `fields` of `ids`, translated into `locale` (English when there is none). */
async function translated(
  container: Resolver,
  entity: string,
  ids: string[],
  fields: string[],
  locale: string | undefined
): Promise<Map<string, TextEntity>> {
  const result = new Map<string, TextEntity>()
  const unique = [...new Set(ids)]
  if (!unique.length) {
    return result
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    { entity, fields: ["id", ...fields], filters: { id: unique } },
    { locale }
  )
  for (const row of data as TextEntity[]) {
    result.set(row.id, row)
  }
  return result
}

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback

/**
 * The filterable attributes of an active, non-internal category (its own and
 * its ancestors'), or null when the category isn't shown in the store.
 */
export async function loadStoreCategoryAttributes(
  container: Resolver,
  categoryId: string,
  locale: string | undefined
): Promise<StoreFilterAttribute[] | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "mpath"],
    filters: { id: categoryId, is_active: true, is_internal: false },
  })
  const category = data[0] as CategoryNode | undefined
  if (!category) {
    return null
  }

  const { effective, definitions } = await loadEffectiveForCategoryNodes(container, [category])
  const shown = effective.filter((entry) => {
    const definition = definitions[entry.attribute_id]
    return !!definition?.filterable && !!facetFor(definition.handle, definition.type as AttributeType)
  })
  const labels = await translated(
    container,
    "attribute_definition",
    shown.map((entry) => entry.attribute_id),
    ["label"],
    locale
  )
  const optionIds = shown.flatMap((entry) =>
    (definitions[entry.attribute_id].options ?? []).map((option) => option.id)
  )
  const optionLabels = await translated(container, "attribute_option", optionIds, ["label"], locale)

  return shown.map((entry) => {
    const definition = definitions[entry.attribute_id]
    const options = [...(definition.options ?? [])]
      .sort((a, b) => a.rank - b.rank || a.handle.localeCompare(b.handle))
      .map((option) => ({
        handle: option.handle,
        label: text(optionLabels.get(option.id)?.label),
        swatch_hex: option.swatch_hex ?? null,
        value: `${definition.handle}:${option.handle}`,
      }))
    return {
      handle: definition.handle,
      label: text(labels.get(definition.id)?.label),
      type: definition.type,
      unit: definition.unit ?? null,
      group_handle: definition.group_handle ?? null,
      rank: entry.rank,
      facet: facetFor(definition.handle, definition.type as AttributeType)!,
      options,
    }
  })
}

/**
 * The spec table of a published product that is in one of `salesChannelIds`,
 * grouped by `group_handle` in rank order; null when the product isn't shown.
 * Only values whose attribute is in the product's current effective set are
 * returned (review finding 9); attributes without a value are left out.
 */
export async function loadStoreProductAttributes(
  container: Resolver,
  productId: string,
  salesChannelIds: string[],
  locale: string | undefined
): Promise<StoreSpecGroup[] | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "sales_channels.id"],
    filters: { id: productId, status: "published" },
  })
  const product = data[0] as { id: string; sales_channels?: { id: string }[] | null } | undefined
  const allowed = new Set(salesChannelIds)
  if (!product || !(product.sales_channels ?? []).some((channel) => allowed.has(channel.id))) {
    return null
  }

  const context = await loadProductAttributeContext(container, productId)
  if (!context.effective.length) {
    return []
  }
  const attributes = resolveAttributes(container)
  const definitionRows = await attributes.listAttributeDefinitions(
    { id: context.effective.map((entry) => entry.attribute_id) },
    { relations: ["options"] }
  )
  const definitions = new Map(definitionRows.map((row) => [row.id, row]))

  const valueByAttribute = new Map(context.existing_values.map((row) => [row.attribute_id, row]))
  const optionIdsByAttribute = new Map<string, string[]>()
  for (const row of context.existing_options) {
    const list = optionIdsByAttribute.get(row.attribute_id) ?? []
    list.push(row.option_id)
    optionIdsByAttribute.set(row.attribute_id, list)
  }

  const labels = await translated(
    container,
    "attribute_definition",
    context.effective.map((entry) => entry.attribute_id),
    ["label"],
    locale
  )
  const optionLabels = await translated(
    container,
    "attribute_option",
    context.existing_options.map((row) => row.option_id),
    ["label"],
    locale
  )
  const valueTexts = await translated(
    container,
    "product_attribute_value",
    context.existing_values.map((row) => row.id),
    ["value_text"],
    locale
  )

  const groups = new Map<string, StoreSpecGroup>()
  for (const entry of context.effective) {
    const definition = definitions.get(entry.attribute_id)
    if (!definition) {
      continue
    }
    let value: StoreSpecValue | null = null
    if (definition.type === "select" || definition.type === "multiselect") {
      const chosen = new Set(optionIdsByAttribute.get(definition.id) ?? [])
      const picked = [...(definition.options ?? [])]
        .filter((option) => chosen.has(option.id))
        .sort((a, b) => a.rank - b.rank || a.handle.localeCompare(b.handle))
        .map((option) => ({
          handle: option.handle,
          label: text(optionLabels.get(option.id)?.label),
          swatch_hex: option.swatch_hex ?? null,
        }))
      value = picked.length ? picked : null
    } else {
      const row = valueByAttribute.get(definition.id)
      if (row) {
        if (definition.type === "number") {
          value = row.value_number
        } else if (definition.type === "boolean") {
          value = row.value_bool
        } else if (row.value_text !== null) {
          value = text(valueTexts.get(row.id)?.value_text, row.value_text)
        }
      }
    }
    if (value === null) {
      continue
    }
    const groupHandle = definition.group_handle ?? DEFAULT_GROUP_HANDLE
    const group = groups.get(groupHandle) ?? { handle: groupHandle, attributes: [] }
    group.attributes.push({
      handle: definition.handle,
      label: text(labels.get(definition.id)?.label),
      type: definition.type,
      unit: definition.unit ?? null,
      value,
    })
    groups.set(groupHandle, group)
  }
  return [...groups.values()]
}

/** A coded 404 for a category or product the store doesn't show. */
export function notShown(code: "category_not_found" | "product_not_found", id: string) {
  return codedError(MedusaError.Types.NOT_FOUND, code, `${id} was not found`)
}
