import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { codedError } from "../../../lib/coded-error"
import type { L10n } from "../../../lib/locales"
import { checkOptionFields, OPTION_TYPES } from "../../../modules/attributes/lib/validate-definition"
import type { AttributeType } from "../../../modules/attributes/models/attribute-definition"
import { isDuplicateError, optionalText, resolveAttributes, TitleL10n } from "./attribute-definition"
import { productIdsWithoutLiveProduct } from "./purge"

export type UpsertAttributeOptionInput = {
  attribute_id: string
  /** Present: update that option. Absent: create one. */
  id?: string
  handle: string
  label: L10n
  /** Undefined leaves it as it is; null clears it in every language. */
  title_label?: TitleL10n | null
  rank?: number
  swatch_hex?: string | null
}

const OPTION_FIELDS = ["id", "attribute_id", "handle", "label", "title_label", "rank", "swatch_hex"] as const

type OptionRow = {
  id: string
  attribute_id: string
  handle: string
  label: string
  title_label: string | null
  rank: number
  swatch_hex: string | null
}

const optionHandleTaken = (handle: string) =>
  codedError(MedusaError.Types.INVALID_DATA, "option_handle_taken", `Option handle ${handle} is already used`)

/** Checks the attribute, the option and handle uniqueness. Writes nothing. */
export const validateUpsertAttributeOptionStep = createStep(
  "validate-upsert-attribute-option",
  async (input: UpsertAttributeOptionInput, { container }) => {
    const fieldError = checkOptionFields({
      handle: input.handle,
      label_en: input.label?.en,
      swatch_hex: input.swatch_hex,
    })
    if (fieldError) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, fieldError)
    }
    const attributes = resolveAttributes(container)
    const [definition] = await attributes.listAttributeDefinitions(
      { id: input.attribute_id },
      { select: ["id", "type"], take: 1 }
    )
    if (!definition) {
      throw codedError(
        MedusaError.Types.NOT_FOUND,
        "attribute_not_found",
        `Attribute ${input.attribute_id} not found`
      )
    }
    if (!OPTION_TYPES.includes(definition.type as AttributeType)) {
      throw codedError(
        MedusaError.Types.INVALID_DATA,
        "options_not_allowed",
        `A ${definition.type} attribute has no options`
      )
    }
    const siblings = (await attributes.listAttributeOptions(
      { attribute_id: input.attribute_id },
      { select: [...OPTION_FIELDS] }
    )) as OptionRow[]
    if (input.id && !siblings.some((option) => option.id === input.id)) {
      throw codedError(MedusaError.Types.NOT_FOUND, "option_not_found", `Option ${input.id} not found`)
    }
    if (siblings.some((option) => option.handle === input.handle && option.id !== input.id)) {
      throw optionHandleTaken(input.handle)
    }
    const nextRank = siblings.reduce((max, option) => Math.max(max, option.rank + 1), 0)
    return new StepResponse({ next_rank: nextRank })
  }
)

export type UpsertAttributeOptionStepInput = UpsertAttributeOptionInput & { next_rank: number }

type UpsertUndo = {
  created_id: string | null
  previous: Omit<OptionRow, "attribute_id"> | null
}

export const upsertAttributeOptionStep = createStep(
  "upsert-attribute-option",
  async (input: UpsertAttributeOptionStepInput, { container }) => {
    const attributes = resolveAttributes(container)
    try {
      if (!input.id) {
        const created = await attributes.createAttributeOptions({
          attribute_id: input.attribute_id,
          handle: input.handle,
          label: input.label.en.trim(),
          title_label: optionalText(input.title_label?.en),
          // New options go to the end unless a rank is given.
          rank: input.rank ?? input.next_rank,
          swatch_hex: input.swatch_hex ?? null,
        })
        return new StepResponse<{ id: string }, UpsertUndo>(
          { id: created.id },
          { created_id: created.id, previous: null }
        )
      }

      const previous = (await attributes.retrieveAttributeOption(input.id, {
        select: [...OPTION_FIELDS],
      })) as OptionRow
      const update: Record<string, unknown> = {
        id: input.id,
        handle: input.handle,
        label: input.label.en.trim(),
      }
      if (input.title_label !== undefined) {
        update.title_label = optionalText(input.title_label?.en)
      }
      if (input.rank !== undefined) {
        update.rank = input.rank
      }
      if (input.swatch_hex !== undefined) {
        update.swatch_hex = input.swatch_hex
      }
      await attributes.updateAttributeOptions(update)
      // Plain columns only (retrieve() also returns `attribute: { id }`).
      const restore = {
        id: previous.id,
        handle: previous.handle,
        label: previous.label,
        title_label: previous.title_label ?? null,
        rank: previous.rank,
        swatch_hex: previous.swatch_hex ?? null,
      }
      return new StepResponse<{ id: string }, UpsertUndo>(
        { id: input.id },
        { created_id: null, previous: restore }
      )
    } catch (error) {
      if (isDuplicateError(error)) {
        throw optionHandleTaken(input.handle)
      }
      throw error
    }
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const attributes = resolveAttributes(container)
    if (undo.created_id) {
      await attributes.deleteAttributeOptions(undo.created_id)
    }
    if (undo.previous) {
      await attributes.updateAttributeOptions(undo.previous)
    }
  }
)

export type DeleteAttributeOptionInput = {
  id: string
  /** When given, the option must belong to this attribute. */
  attribute_id?: string
}

/** Refuses to delete an option that any product uses. Writes nothing. */
export const validateDeleteAttributeOptionStep = createStep(
  "validate-delete-attribute-option",
  async (input: DeleteAttributeOptionInput, { container }) => {
    const attributes = resolveAttributes(container)
    const [option] = await attributes.listAttributeOptions(
      { id: input.id },
      { select: ["id", "attribute_id"], take: 1 }
    )
    if (!option || (input.attribute_id && option.attribute_id !== input.attribute_id)) {
      throw codedError(MedusaError.Types.NOT_FOUND, "option_not_found", `Option ${input.id} not found`)
    }
    const used = await attributes.listProductAttributeOptions(
      { option_id: input.id },
      { select: ["product_id"] }
    )
    const productIds = [...new Set(used.map((row) => row.product_id))]
    // Rows of a deleted product don't count (G2 review finding 1); the
    // workflow removes them with the option.
    const orphanProductIds = await productIdsWithoutLiveProduct(container, productIds)
    if (orphanProductIds.length < productIds.length) {
      throw codedError(
        MedusaError.Types.NOT_ALLOWED,
        "option_in_use",
        "Products still use this option; change them first"
      )
    }
    return new StepResponse({ id: option.id, orphan_product_ids: orphanProductIds })
  }
)

export const softDeleteAttributeOptionStep = createStep(
  "soft-delete-attribute-option",
  async (input: { id: string }, { container }) => {
    await resolveAttributes(container).softDeleteAttributeOptions([input.id])
    return new StepResponse({ id: input.id }, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    await resolveAttributes(container).restoreAttributeOptions([id])
  }
)
