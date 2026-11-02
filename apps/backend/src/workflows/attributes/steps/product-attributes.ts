import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { codedError } from "../../../lib/coded-error"
import {
  CategoryLink,
  CategoryNode,
  effectiveForCategories,
  EffectiveAttribute,
} from "../../../modules/attributes/lib/effective-attributes"
import {
  AttributeValueInput,
  DefinitionForValues,
  describeAttributeValueError,
  ExistingOptionRow,
  ExistingValueRow,
  OptionForValues,
  planProductAttributeChanges,
  ProductAttributePlan,
} from "../../../modules/attributes/lib/plan-values"
import type { AttributeType } from "../../../modules/attributes/models/attribute-definition"
import { resolveAttributes } from "./attribute-definition"

export const SEARCH_KEYWORDS_MAX = 500

export type SetProductAttributesInput = {
  product_id: string
  values: AttributeValueInput[]
  /** Staff search keywords, stored in product metadata.search_keywords. */
  search_keywords?: string | null
}

export type ProductAttributeContext = {
  product_id: string
  metadata: Record<string, unknown>
  category_ids: string[]
  effective: EffectiveAttribute[]
  definitions: Record<string, DefinitionForValues & { required: boolean; rank: number }>
  options_by_id: Record<string, OptionForValues>
  existing_values: ExistingValueRow[]
  existing_options: ExistingOptionRow[]
}

const VALUE_FIELDS = ["id", "attribute_id", "value_text", "value_number", "value_bool"] as const
const OPTION_ROW_FIELDS = ["id", "attribute_id", "option_id"] as const

/**
 * Loads what a product's attribute values depend on: its categories and their
 * ancestors' links (the effective set), the definitions and options involved,
 * and the product's current rows. Writes nothing.
 */
export async function loadProductAttributeContext(
  container: { resolve: (key: string) => any },
  productId: string,
  values: AttributeValueInput[] = []
): Promise<ProductAttributeContext> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const attributes = resolveAttributes(container)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "metadata", "categories.id"],
    filters: { id: productId },
  })
  const product = products[0] as
    | { id: string; metadata: Record<string, unknown> | null; categories?: { id: string }[] | null }
    | undefined
  if (!product) {
    throw codedError(MedusaError.Types.NOT_FOUND, "product_not_found", `Product ${productId} not found`)
  }
  const categoryIds = (product.categories ?? []).map((c) => c.id)

  const categoriesById: Record<string, CategoryNode> = {}
  if (categoryIds.length) {
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id", "mpath"],
      filters: { id: categoryIds },
    })
    for (const category of categories as CategoryNode[]) {
      categoriesById[category.id] = category
    }
  }
  const chainIds = new Set<string>()
  for (const category of Object.values(categoriesById)) {
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

  // Plain columns only: list() also returns the relation as `attribute: { id }`,
  // and passing that back to create() (the compensation re-creates deleted
  // rows) makes MikroORM try to create a new AttributeDefinition.
  const existingValues: ExistingValueRow[] = (
    await attributes.listProductAttributeValues(
      { product_id: productId, variant_id: null },
      { select: [...VALUE_FIELDS] }
    )
  ).map((row) => ({
    id: row.id,
    attribute_id: row.attribute_id,
    value_text: row.value_text ?? null,
    value_number: row.value_number ?? null,
    value_bool: row.value_bool ?? null,
  }))
  const existingOptions: ExistingOptionRow[] = (
    await attributes.listProductAttributeOptions(
      { product_id: productId, variant_id: null },
      { select: [...OPTION_ROW_FIELDS] }
    )
  ).map((row) => ({ id: row.id, attribute_id: row.attribute_id, option_id: row.option_id }))

  const definitionIds = new Set<string>([
    ...links.map((l) => l.attribute_id),
    ...values.map((v) => v?.attribute_id).filter((id): id is string => typeof id === "string"),
    ...existingValues.map((v) => v.attribute_id),
    ...existingOptions.map((o) => o.attribute_id),
  ])
  const definitionRows = definitionIds.size
    ? await attributes.listAttributeDefinitions(
        { id: [...definitionIds] },
        { select: ["id", "handle", "type", "required", "rank", "label"] }
      )
    : []
  const definitions: ProductAttributeContext["definitions"] = {}
  for (const row of definitionRows) {
    definitions[row.id] = {
      id: row.id,
      handle: row.handle,
      type: row.type as AttributeType,
      label: row.label ?? null,
      required: row.required,
      rank: row.rank,
    }
  }

  const optionIds = new Set<string>()
  for (const value of values) {
    if (Array.isArray(value?.option_ids)) {
      for (const id of value.option_ids) {
        if (typeof id === "string") {
          optionIds.add(id)
        }
      }
    }
  }
  const optionRows = optionIds.size
    ? await attributes.listAttributeOptions({ id: [...optionIds] }, { select: ["id", "attribute_id"] })
    : []
  const optionsById: Record<string, OptionForValues> = {}
  for (const row of optionRows) {
    optionsById[row.id] = { id: row.id, attribute_id: row.attribute_id }
  }

  return {
    product_id: product.id,
    metadata: product.metadata ?? {},
    category_ids: categoryIds,
    effective: effectiveForCategories(categoryIds, categoriesById, links, definitions),
    definitions,
    options_by_id: optionsById,
    existing_values: existingValues,
    existing_options: existingOptions,
  }
}

export const loadProductAttributeContextStep = createStep(
  "load-product-attribute-context",
  async (input: SetProductAttributesInput, { container }) => {
    const context = await loadProductAttributeContext(container, input.product_id, input.values ?? [])
    return new StepResponse(context)
  }
)

export type PlannedProductAttributes = {
  plan: ProductAttributePlan
  /** The full metadata to write, or null when the keywords are unchanged. */
  metadata: Record<string, unknown> | null
}

/** Plans the diff and throws the first error, naming every handle. Writes nothing. */
export const planProductAttributesStep = createStep(
  "plan-product-attributes",
  async (input: { context: ProductAttributeContext; input: SetProductAttributesInput }) => {
    const { context } = input
    const plan = planProductAttributeChanges({
      effective: context.effective,
      definitions: context.definitions,
      optionsById: context.options_by_id,
      existingValues: context.existing_values,
      existingOptions: context.existing_options,
      input: input.input.values ?? [],
    })
    if (plan.errors.length) {
      const [first] = plan.errors
      throw codedError(MedusaError.Types.INVALID_DATA, first.code, describeAttributeValueError(first))
    }

    let metadata: Record<string, unknown> | null = null
    const keywords = input.input.search_keywords
    if (keywords !== undefined) {
      if (keywords !== null && typeof keywords !== "string") {
        throw codedError(MedusaError.Types.INVALID_DATA, "invalid_search_keywords", "Search keywords must be text")
      }
      const next = (keywords ?? "").trim()
      if (next.length > SEARCH_KEYWORDS_MAX) {
        throw codedError(
          MedusaError.Types.INVALID_DATA,
          "search_keywords_too_long",
          `Search keywords are longer than ${SEARCH_KEYWORDS_MAX} characters`
        )
      }
      const current = context.metadata.search_keywords
      if ((typeof current === "string" ? current : "") !== next) {
        metadata = { ...context.metadata, search_keywords: next }
      }
    }
    return new StepResponse<PlannedProductAttributes>({ plan, metadata })
  }
)

type ApplyUndo = {
  created_value_ids: string[]
  created_option_ids: string[]
  previous_values: ExistingValueRow[]
  deleted_values: (ExistingValueRow & { product_id: string; variant_id: null })[]
  deleted_options: (ExistingOptionRow & { product_id: string; variant_id: null })[]
}

export type ApplyProductAttributeDiffInput = {
  product_id: string
  plan: ProductAttributePlan
  existing_values: ExistingValueRow[]
  existing_options: ExistingOptionRow[]
}

/**
 * Writes the planned rows: deletes first, then updates, then creates. The
 * compensation deletes the created rows, restores the updated values and
 * re-creates the deleted rows with their ids.
 */
export const applyProductAttributeDiffStep = createStep(
  "apply-product-attribute-diff",
  async (input: ApplyProductAttributeDiffInput, { container }) => {
    const attributes = resolveAttributes(container)
    const { plan } = input
    const undo: ApplyUndo = {
      created_value_ids: [],
      created_option_ids: [],
      previous_values: [],
      deleted_values: [],
      deleted_options: [],
    }
    const valueById = new Map(input.existing_values.map((row) => [row.id, row]))
    const optionById = new Map(input.existing_options.map((row) => [row.id, row]))

    // Each write is recorded in `undo` as soon as it succeeds, and a failure
    // part-way rolls back what this step already did (a failing step is not
    // compensated by the engine).
    try {
      if (plan.deleteOptionIds.length) {
        await attributes.deleteProductAttributeOptions(plan.deleteOptionIds)
        undo.deleted_options = plan.deleteOptionIds
          .map((id) => optionById.get(id))
          .filter((row): row is ExistingOptionRow => !!row)
          .map((row) => ({
            id: row.id,
            attribute_id: row.attribute_id,
            option_id: row.option_id,
            product_id: input.product_id,
            variant_id: null,
          }))
      }
      if (plan.deleteValueIds.length) {
        await attributes.deleteProductAttributeValues(plan.deleteValueIds)
        undo.deleted_values = plan.deleteValueIds
          .map((id) => valueById.get(id))
          .filter((row): row is ExistingValueRow => !!row)
          .map((row) => ({
            id: row.id,
            attribute_id: row.attribute_id,
            value_text: row.value_text,
            value_number: row.value_number,
            value_bool: row.value_bool,
            product_id: input.product_id,
            variant_id: null,
          }))
      }
      if (plan.updateValues.length) {
        await attributes.updateProductAttributeValues(plan.updateValues)
        undo.previous_values = plan.updateValues
          .map((update) => valueById.get(update.id))
          .filter((row): row is ExistingValueRow => !!row)
          .map((row) => ({
            id: row.id,
            attribute_id: row.attribute_id,
            value_text: row.value_text,
            value_number: row.value_number,
            value_bool: row.value_bool,
          }))
      }
      const createdValueIds: Record<string, string> = {}
      if (plan.createValues.length) {
        const created = await attributes.createProductAttributeValues(
          plan.createValues.map((value) => ({ ...value, product_id: input.product_id, variant_id: null }))
        )
        undo.created_value_ids = created.map((row) => row.id)
        for (const row of created) {
          createdValueIds[row.attribute_id] = row.id
        }
      }
      if (plan.createOptions.length) {
        const created = await attributes.createProductAttributeOptions(
          plan.createOptions.map((option) => ({
            ...option,
            product_id: input.product_id,
            variant_id: null,
          }))
        )
        undo.created_option_ids = created.map((row) => row.id)
      }
      return new StepResponse({ created_value_ids: createdValueIds }, undo)
    } catch (error) {
      await undoProductAttributeDiff(attributes, undo)
      throw error
    }
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await undoProductAttributeDiff(resolveAttributes(container), undo)
  }
)

async function undoProductAttributeDiff(
  attributes: ReturnType<typeof resolveAttributes>,
  undo: ApplyUndo
) {
  if (undo.created_option_ids.length) {
    await attributes.deleteProductAttributeOptions(undo.created_option_ids)
  }
  if (undo.created_value_ids.length) {
    await attributes.deleteProductAttributeValues(undo.created_value_ids)
  }
  if (undo.previous_values.length) {
    await attributes.updateProductAttributeValues(
      undo.previous_values.map((row) => ({
        id: row.id,
        value_text: row.value_text,
        value_number: row.value_number,
        value_bool: row.value_bool,
      }))
    )
  }
  if (undo.deleted_values.length) {
    await attributes.createProductAttributeValues(undo.deleted_values)
  }
  if (undo.deleted_options.length) {
    await attributes.createProductAttributeOptions(undo.deleted_options)
  }
}
