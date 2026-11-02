import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { codedError } from "../../../lib/coded-error"
import { resolveAttributes } from "./attribute-definition"

export type CategoryLinkInput = {
  category_id: string
  rank?: number
  required_override?: boolean | null
}

export type SetAttributeCategoriesInput = {
  attribute_id: string
  categories: CategoryLinkInput[]
}

type LinkRow = {
  id: string
  category_id: string
  attribute_id: string
  rank: number
  required_override: boolean | null
}

/** Checks the attribute and that every category exists. Writes nothing. */
export const validateAttributeCategoriesStep = createStep(
  "validate-attribute-categories",
  async (input: SetAttributeCategoriesInput, { container }) => {
    const attributes = resolveAttributes(container)
    const [definition] = await attributes.listAttributeDefinitions(
      { id: input.attribute_id },
      { select: ["id"], take: 1 }
    )
    if (!definition) {
      throw codedError(
        MedusaError.Types.NOT_FOUND,
        "attribute_not_found",
        `Attribute ${input.attribute_id} not found`
      )
    }
    const ids = (input.categories ?? []).map((c) => c.category_id)
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    if (duplicates.length) {
      throw codedError(
        MedusaError.Types.INVALID_DATA,
        "duplicate_category",
        `Category listed more than once: ${[...new Set(duplicates)].join(", ")}`
      )
    }
    if (!ids.length) {
      return new StepResponse(undefined)
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id"],
      filters: { id: ids },
    })
    const found = new Set(categories.map((c: { id: string }) => c.id))
    const missing = ids.filter((id) => !found.has(id))
    if (missing.length) {
      throw codedError(
        MedusaError.Types.NOT_FOUND,
        "category_not_found",
        `Categories not found: ${missing.join(", ")}`
      )
    }
    return new StepResponse(undefined)
  }
)

type LinksUndo = {
  created_ids: string[]
  previous_updates: LinkRow[]
  deleted: LinkRow[]
}

/**
 * Makes the attribute's links equal to `categories` (diffed, so unchanged
 * links keep their ids). The compensation deletes the created links, restores
 * the updated ones and re-creates the deleted ones with their ids.
 */
export const replaceCategoryLinksStep = createStep(
  "replace-category-links",
  async (input: SetAttributeCategoriesInput, { container }) => {
    const attributes = resolveAttributes(container)
    // Plain columns only: list() also returns `attribute: { id }`, which would
    // make the compensation's create() try to create an AttributeDefinition.
    const existing: LinkRow[] = (
      await attributes.listCategoryAttributes(
        { attribute_id: input.attribute_id },
        { select: ["id", "category_id", "attribute_id", "rank", "required_override"] }
      )
    ).map((link) => ({
      id: link.id,
      category_id: link.category_id,
      attribute_id: link.attribute_id,
      rank: link.rank,
      required_override: link.required_override ?? null,
    }))
    const byCategory = new Map(existing.map((link) => [link.category_id, link]))
    const wanted = new Map((input.categories ?? []).map((c) => [c.category_id, c]))

    const undo: LinksUndo = { created_ids: [], previous_updates: [], deleted: [] }

    const toDelete = existing.filter((link) => !wanted.has(link.category_id))
    if (toDelete.length) {
      await attributes.deleteCategoryAttributes(toDelete.map((link) => link.id))
      undo.deleted = toDelete
    }

    const updates: { id: string; rank: number; required_override: boolean | null }[] = []
    const creates: Omit<LinkRow, "id">[] = []
    for (const [categoryId, link] of wanted) {
      const rank = link.rank ?? 0
      const requiredOverride = link.required_override ?? null
      const current = byCategory.get(categoryId)
      if (!current) {
        creates.push({
          category_id: categoryId,
          attribute_id: input.attribute_id,
          rank,
          required_override: requiredOverride,
        })
      } else if (current.rank !== rank || (current.required_override ?? null) !== requiredOverride) {
        updates.push({ id: current.id, rank, required_override: requiredOverride })
        undo.previous_updates.push(current)
      }
    }
    if (updates.length) {
      await attributes.updateCategoryAttributes(updates)
    }
    if (creates.length) {
      const created = await attributes.createCategoryAttributes(creates)
      undo.created_ids = created.map((link) => link.id)
    }

    return new StepResponse(
      {
        created: undo.created_ids.length,
        updated: updates.length,
        deleted: toDelete.length,
      },
      undo
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const attributes = resolveAttributes(container)
    if (undo.created_ids.length) {
      await attributes.deleteCategoryAttributes(undo.created_ids)
    }
    if (undo.previous_updates.length) {
      await attributes.updateCategoryAttributes(
        undo.previous_updates.map((link) => ({
          id: link.id,
          rank: link.rank,
          required_override: link.required_override,
        }))
      )
    }
    if (undo.deleted.length) {
      await attributes.createCategoryAttributes(undo.deleted)
    }
  }
)
