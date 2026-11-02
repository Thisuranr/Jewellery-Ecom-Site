import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { codedError } from "../../../lib/coded-error"
import type { L10n } from "../../../lib/locales"
import { ATTRIBUTES_MODULE } from "../../../modules/attributes"
import {
  checkDefinitionFields,
  checkOptionFields,
  OPTION_TYPES,
} from "../../../modules/attributes/lib/validate-definition"
import type { AttributeType } from "../../../modules/attributes/models/attribute-definition"
import type AttributesModuleService from "../../../modules/attributes/service"
import { productIdsWithoutLiveProduct } from "./purge"

/**
 * Text that may be empty in English: an option's `title_label`. `en` empty or
 * null stores null (the title then uses `label`); si/ta follow the L10n rules.
 */
export type TitleL10n = { en?: string | null; si?: string | null; ta?: string | null }

export type OptionInput = {
  handle: string
  label: L10n
  title_label?: TitleL10n | null
  rank?: number
  swatch_hex?: string | null
}

export type CreateAttributeInput = {
  handle: string
  type: AttributeType
  unit?: string | null
  group_handle?: string | null
  filterable?: boolean
  required?: boolean
  rank?: number
  label: L10n
  options?: OptionInput[]
}

export type UpdateAttributeInput = {
  id: string
  label?: L10n
  unit?: string | null
  group_handle?: string | null
  filterable?: boolean
  required?: boolean
  rank?: number
  /** Never allowed; present only so the workflow can refuse it. */
  handle?: unknown
  /** Never allowed; present only so the workflow can refuse it. */
  type?: unknown
}

const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

export const resolveAttributes = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(ATTRIBUTES_MODULE) as AttributesModuleService

/** Null for empty text; the trimmed text otherwise. */
export const optionalText = (value: string | null | undefined): string | null =>
  value && value.trim() ? value.trim() : null

export function isDuplicateError(error: unknown): boolean {
  const e = error as { type?: string; code?: string; message?: string }
  return (
    e?.type === MedusaError.Types.DUPLICATE_ERROR ||
    e?.code === "23505" ||
    /already exists|duplicate key/i.test(e?.message ?? "")
  )
}

/** Checks a new attribute and its options. Writes nothing. */
export const validateCreateAttributeStep = createStep(
  "validate-create-attribute",
  async (input: CreateAttributeInput, { container }) => {
    const fieldError = checkDefinitionFields(
      { handle: input.handle, type: input.type, unit: input.unit, label_en: input.label?.en },
      { creating: true }
    )
    if (fieldError) {
      throw invalid(fieldError)
    }
    const options = input.options ?? []
    if (options.length && !OPTION_TYPES.includes(input.type)) {
      throw codedError(
        MedusaError.Types.INVALID_DATA,
        "options_not_allowed",
        `A ${input.type} attribute has no options`
      )
    }
    const handles = new Set<string>()
    for (const option of options) {
      const optionError = checkOptionFields({
        handle: option.handle,
        label_en: option.label?.en,
        swatch_hex: option.swatch_hex,
      })
      if (optionError) {
        throw invalid(optionError)
      }
      if (handles.has(option.handle)) {
        throw codedError(
          MedusaError.Types.INVALID_DATA,
          "duplicate_option_handle",
          `Option handle ${option.handle} is used twice`
        )
      }
      handles.add(option.handle)
    }

    const attributes = resolveAttributes(container)
    const [existing] = await attributes.listAttributeDefinitions(
      { handle: input.handle },
      { select: ["id"], take: 1 }
    )
    if (existing) {
      throw codedError(
        MedusaError.Types.INVALID_DATA,
        "handle_taken",
        `An attribute with handle ${input.handle} already exists`
      )
    }
    return new StepResponse(undefined)
  }
)

export const createAttributeDefinitionStep = createStep(
  "create-attribute-definition",
  async (input: CreateAttributeInput, { container }) => {
    const attributes = resolveAttributes(container)
    try {
      const definition = await attributes.createAttributeDefinitions({
        handle: input.handle,
        type: input.type,
        label: input.label.en.trim(),
        unit: input.unit ?? null,
        group_handle: optionalText(input.group_handle),
        filterable: input.filterable ?? false,
        required: input.required ?? false,
        rank: input.rank ?? 0,
      })
      return new StepResponse({ id: definition.id }, definition.id)
    } catch (error) {
      if (isDuplicateError(error)) {
        throw codedError(
          MedusaError.Types.INVALID_DATA,
          "handle_taken",
          `An attribute with handle ${input.handle} already exists`
        )
      }
      throw error
    }
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    await resolveAttributes(container).deleteAttributeDefinitions(id)
  }
)

export type CreateAttributeOptionsStepInput = {
  attribute_id: string
  options: OptionInput[]
}

export const createAttributeOptionsStep = createStep(
  "create-attribute-options",
  async (input: CreateAttributeOptionsStepInput, { container }) => {
    if (!input.options.length) {
      return new StepResponse([] as { id: string; handle: string }[], [] as string[])
    }
    const created = await resolveAttributes(container).createAttributeOptions(
      input.options.map((option, index) => ({
        attribute_id: input.attribute_id,
        handle: option.handle,
        label: option.label.en.trim(),
        title_label: optionalText(option.title_label?.en),
        // Without a rank, options keep the order they were sent in.
        rank: option.rank ?? index,
        swatch_hex: option.swatch_hex ?? null,
      }))
    )
    return new StepResponse(
      created.map((option) => ({ id: option.id, handle: option.handle })),
      created.map((option) => option.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    await resolveAttributes(container).deleteAttributeOptions(ids)
  }
)

/** Refuses handle/type changes and checks the other fields. Writes nothing. */
export const validateUpdateAttributeStep = createStep(
  "validate-update-attribute",
  async (input: UpdateAttributeInput, { container }) => {
    if (input.handle !== undefined) {
      throw codedError(MedusaError.Types.INVALID_DATA, "handle_immutable", "The handle can't be changed")
    }
    if (input.type !== undefined) {
      throw codedError(MedusaError.Types.INVALID_DATA, "type_immutable", "The type can't be changed")
    }
    const fieldError = checkDefinitionFields(
      {
        unit: input.unit,
        label_en: input.label === undefined ? undefined : (input.label?.en ?? null),
      },
      { creating: false }
    )
    if (fieldError) {
      throw invalid(fieldError)
    }
    const [existing] = await resolveAttributes(container).listAttributeDefinitions(
      { id: input.id },
      { select: ["id"], take: 1 }
    )
    if (!existing) {
      throw codedError(MedusaError.Types.NOT_FOUND, "attribute_not_found", `Attribute ${input.id} not found`)
    }
    return new StepResponse(undefined)
  }
)

const UPDATABLE_FIELDS = ["label", "unit", "group_handle", "filterable", "required", "rank"] as const

export const updateAttributeDefinitionStep = createStep(
  "update-attribute-definition",
  async (input: UpdateAttributeInput, { container }) => {
    const attributes = resolveAttributes(container)
    const previous = await attributes.retrieveAttributeDefinition(input.id, {
      select: ["id", ...UPDATABLE_FIELDS],
    })
    const update: Record<string, unknown> = { id: input.id }
    if (input.label !== undefined) {
      update.label = input.label.en.trim()
    }
    if (input.unit !== undefined) {
      update.unit = input.unit
    }
    if (input.group_handle !== undefined) {
      update.group_handle = optionalText(input.group_handle)
    }
    for (const key of ["filterable", "required", "rank"] as const) {
      if (input[key] !== undefined) {
        update[key] = input[key]
      }
    }
    await attributes.updateAttributeDefinitions(update)
    const restore: Record<string, unknown> = { id: previous.id }
    for (const key of UPDATABLE_FIELDS) {
      restore[key] = previous[key]
    }
    return new StepResponse({ id: input.id }, restore)
  },
  async (restore, { container }) => {
    if (!restore) {
      return
    }
    await resolveAttributes(container).updateAttributeDefinitions(restore)
  }
)

/** Refuses to delete an attribute that any product uses. Writes nothing. */
export const validateDeleteAttributeStep = createStep(
  "validate-delete-attribute",
  async (input: { id: string }, { container }) => {
    const attributes = resolveAttributes(container)
    const [definition] = await attributes.listAttributeDefinitions(
      { id: input.id },
      { select: ["id"], take: 1 }
    )
    if (!definition) {
      throw codedError(MedusaError.Types.NOT_FOUND, "attribute_not_found", `Attribute ${input.id} not found`)
    }
    const values = await attributes.listProductAttributeValues(
      { attribute_id: input.id },
      { select: ["product_id"] }
    )
    const productOptions = await attributes.listProductAttributeOptions(
      { attribute_id: input.id },
      { select: ["product_id"] }
    )
    const productIds = [...new Set([...values, ...productOptions].map((row) => row.product_id))]
    // Rows of a deleted product don't count (G2 review finding 1); the
    // workflow removes them with the attribute.
    const orphanProductIds = await productIdsWithoutLiveProduct(container, productIds)
    if (orphanProductIds.length < productIds.length) {
      throw codedError(
        MedusaError.Types.NOT_ALLOWED,
        "attribute_in_use",
        "Products still have values for this attribute; clear them first"
      )
    }
    const options = await attributes.listAttributeOptions({ attribute_id: input.id }, { select: ["id"] })
    const links = await attributes.listCategoryAttributes({ attribute_id: input.id }, { select: ["id"] })
    return new StepResponse({
      definition_id: definition.id,
      option_ids: options.map((o) => o.id),
      link_ids: links.map((l) => l.id),
      orphan_product_ids: orphanProductIds,
    })
  }
)

export type SoftDeleteAttributeStepInput = {
  definition_id: string
  option_ids: string[]
  link_ids: string[]
}

/** Soft-deletes the links, options and definition; the compensation restores them. */
export const softDeleteAttributeStep = createStep(
  "soft-delete-attribute",
  async (input: SoftDeleteAttributeStepInput, { container }) => {
    const attributes = resolveAttributes(container)
    if (input.link_ids.length) {
      await attributes.softDeleteCategoryAttributes(input.link_ids)
    }
    if (input.option_ids.length) {
      await attributes.softDeleteAttributeOptions(input.option_ids)
    }
    await attributes.softDeleteAttributeDefinitions([input.definition_id])
    return new StepResponse({ id: input.definition_id }, input)
  },
  async (input, { container }) => {
    if (!input) {
      return
    }
    const attributes = resolveAttributes(container)
    await attributes.restoreAttributeDefinitions([input.definition_id])
    if (input.option_ids.length) {
      await attributes.restoreAttributeOptions(input.option_ids)
    }
    if (input.link_ids.length) {
      await attributes.restoreCategoryAttributes(input.link_ids)
    }
  }
)
