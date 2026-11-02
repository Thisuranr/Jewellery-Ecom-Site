import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ATTRIBUTES_MODULE } from "../../../modules/attributes"
import type AttributesModuleService from "../../../modules/attributes/service"

/**
 * Removing what a deleted product or category leaves in the attributes module
 * (G2 review finding 1). Products and categories live in Medusa's product
 * module, which soft-deletes them and knows nothing of our rows, so the
 * `product.deleted` and `product-category.deleted` subscribers call these.
 * The rows are hard-deleted: a deleted product or category can't be restored
 * from the admin, so nothing would ever read them again. Each compensation
 * re-creates the rows with their ids.
 */

// Not `resolveAttributes` from ./attribute-definition: that file imports this one.
const resolveAttributes = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(ATTRIBUTES_MODULE) as AttributesModuleService

export type PurgeValueRow = {
  id: string
  product_id: string
  variant_id: string | null
  attribute_id: string
  value_text: string | null
  value_number: number | null
  value_bool: boolean | null
}

export type PurgeOptionRow = {
  id: string
  product_id: string
  variant_id: string | null
  attribute_id: string
  option_id: string
}

export type ProductAttributeRows = {
  values: PurgeValueRow[]
  options: PurgeOptionRow[]
}

export type PurgeLinkRow = {
  id: string
  category_id: string
  attribute_id: string
  rank: number
  required_override: boolean | null
}

/**
 * Of these product ids, the ones with no live product: soft-deleted, or never
 * there at all. Used by the in-use checks of the attribute and option deletes,
 * so rows a deleted product left behind never block them.
 */
export async function productIdsWithoutLiveProduct(
  container: Pick<MedusaContainer, "resolve">,
  productIds: string[]
): Promise<string[]> {
  const ids = [...new Set(productIds)]
  if (!ids.length) {
    return []
  }
  const products = await container
    .resolve(Modules.PRODUCT)
    .listProducts({ id: ids }, { select: ["id"] })
  const live = new Set(products.map((product: { id: string }) => product.id))
  return ids.filter((id) => !live.has(id))
}

/** Every attribute row of these products, as plain columns. Writes nothing. */
export const loadProductAttributeRowsStep = createStep(
  "load-product-attribute-rows",
  async (input: { product_ids: string[] }, { container }) => {
    const ids = [...new Set(input.product_ids ?? [])]
    if (!ids.length) {
      return new StepResponse<ProductAttributeRows>({ values: [], options: [] })
    }
    const attributes = resolveAttributes(container)
    // Plain columns only: list() also returns `attribute: { id }`, which the
    // compensation's create() would read as a new AttributeDefinition (B3 note).
    const values = (
      await attributes.listProductAttributeValues(
        { product_id: ids },
        {
          select: ["id", "product_id", "variant_id", "attribute_id", "value_text", "value_number", "value_bool"],
        }
      )
    ).map(
      (row): PurgeValueRow => ({
        id: row.id,
        product_id: row.product_id,
        variant_id: row.variant_id ?? null,
        attribute_id: row.attribute_id,
        value_text: row.value_text ?? null,
        value_number: row.value_number ?? null,
        value_bool: row.value_bool ?? null,
      })
    )
    const options = (
      await attributes.listProductAttributeOptions(
        { product_id: ids },
        { select: ["id", "product_id", "variant_id", "attribute_id", "option_id"] }
      )
    ).map(
      (row): PurgeOptionRow => ({
        id: row.id,
        product_id: row.product_id,
        variant_id: row.variant_id ?? null,
        attribute_id: row.attribute_id,
        option_id: row.option_id,
      })
    )
    return new StepResponse<ProductAttributeRows>({ values, options })
  }
)

/** Hard-deletes the given product rows; the compensation re-creates them with their ids. */
export const deleteProductAttributeRowsStep = createStep(
  "delete-product-attribute-rows",
  async (input: ProductAttributeRows, { container }) => {
    const attributes = resolveAttributes(container)
    const undo: ProductAttributeRows = { values: [], options: [] }
    try {
      if (input.options.length) {
        await attributes.deleteProductAttributeOptions(input.options.map((row) => row.id))
        undo.options = input.options
      }
      if (input.values.length) {
        await attributes.deleteProductAttributeValues(input.values.map((row) => row.id))
        undo.values = input.values
      }
    } catch (error) {
      // A failing step is not compensated by the engine: undo what this one did.
      await restoreProductAttributeRows(attributes, undo)
      throw error
    }
    return new StepResponse({ values: undo.values.length, options: undo.options.length }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    await restoreProductAttributeRows(resolveAttributes(container), undo)
  }
)

async function restoreProductAttributeRows(
  attributes: ReturnType<typeof resolveAttributes>,
  undo: ProductAttributeRows
) {
  if (undo.values.length) {
    await attributes.createProductAttributeValues(undo.values)
  }
  if (undo.options.length) {
    await attributes.createProductAttributeOptions(undo.options)
  }
}

/** Every attribute link of these categories, as plain columns. Writes nothing. */
export const loadCategoryLinksStep = createStep(
  "load-category-links",
  async (input: { category_ids: string[] }, { container }) => {
    const ids = [...new Set(input.category_ids ?? [])]
    if (!ids.length) {
      return new StepResponse<PurgeLinkRow[]>([])
    }
    const links = (
      await resolveAttributes(container).listCategoryAttributes(
        { category_id: ids },
        { select: ["id", "category_id", "attribute_id", "rank", "required_override"] }
      )
    ).map(
      (link): PurgeLinkRow => ({
        id: link.id,
        category_id: link.category_id,
        attribute_id: link.attribute_id,
        rank: link.rank,
        required_override: link.required_override ?? null,
      })
    )
    return new StepResponse(links)
  }
)

/** Hard-deletes the given links; the compensation re-creates them with their ids. */
export const deleteCategoryLinksStep = createStep(
  "delete-category-links",
  async (links: PurgeLinkRow[], { container }) => {
    if (!links.length) {
      return new StepResponse({ deleted: 0 }, [] as PurgeLinkRow[])
    }
    await resolveAttributes(container).deleteCategoryAttributes(links.map((link) => link.id))
    return new StepResponse({ deleted: links.length }, links)
  },
  async (links, { container }) => {
    if (!links?.length) {
      return
    }
    await resolveAttributes(container).createCategoryAttributes(links)
  }
)
