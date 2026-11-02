import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { CONTROL_CHARS_MESSAGE, hasControlChars } from "../../../lib/text-safety"
import { l10nSchema } from "../../../lib/locales"
import { ATTRIBUTE_LABEL_MAX } from "../../../modules/attributes/lib/validate-definition"
import { ATTRIBUTE_TYPES } from "../../../modules/attributes/models/attribute-definition"

/**
 * Request schemas of the attributes admin API (plan M1 B4). They check shapes
 * and sizes only; the field rules (handle pattern, unit list, swatch format)
 * live in the workflows, which answer with a coded error ("invalid_handle: ...")
 * the admin pages can show.
 */

/** A string with no NUL or other control characters (Postgres rejects NUL with a 500). */
const noControl = (max: number) =>
  z
    .string()
    .max(max)
    .refine((v) => !hasControlChars(v), { message: CONTROL_CHARS_MESSAGE })

const shortText = z.string().trim().max(100).refine((v) => !hasControlChars(v), { message: CONTROL_CHARS_MESSAGE })
const smallInt = z.number().int().min(0).max(1_000_000)

/** An option's `title_label`: English may be empty (the title then uses `label`). */
const titleL10nSchema = z
  .object({
    en: shortText.nullable().optional(),
  })
  .strict()

const optionInputSchema = z
  .object({
    handle: noControl(40),
    label: l10nSchema(ATTRIBUTE_LABEL_MAX),
    title_label: titleL10nSchema.nullable().optional(),
    rank: smallInt.optional(),
    swatch_hex: noControl(7).nullable().optional(),
  })
  .strict()

export const AdminCreateAttributeSchema = z
  .object({
    handle: noControl(40),
    type: z.enum(ATTRIBUTE_TYPES),
    unit: noControl(20).nullable().optional(),
    group_handle: shortText.nullable().optional(),
    filterable: z.boolean().optional(),
    required: z.boolean().optional(),
    rank: smallInt.optional(),
    label: l10nSchema(ATTRIBUTE_LABEL_MAX),
    options: z.array(optionInputSchema).max(300).optional(),
  })
  .strict()

/**
 * `handle` and `type` are accepted here only so the workflow can refuse them
 * with `handle_immutable` / `type_immutable`.
 */
export const AdminUpdateAttributeSchema = z
  .object({
    label: l10nSchema(ATTRIBUTE_LABEL_MAX).optional(),
    unit: noControl(20).nullable().optional(),
    group_handle: shortText.nullable().optional(),
    filterable: z.boolean().optional(),
    required: z.boolean().optional(),
    rank: smallInt.optional(),
    handle: z.unknown().optional(),
    type: z.unknown().optional(),
  })
  .strict()

export const AdminOptionInputSchema = optionInputSchema

export const AdminSetAttributeCategoriesSchema = z
  .object({
    categories: z
      .array(
        z
          .object({
            category_id: noControl(100).min(1),
            rank: smallInt.optional(),
            required_override: z.boolean().nullable().optional(),
          })
          .strict()
      )
      .max(500),
  })
  .strict()

const valueInputSchema = z
  .object({
    attribute_id: noControl(100).min(1),
    option_ids: z.array(noControl(100).min(1)).max(300).nullable().optional(),
    value_number: z.number().nullable().optional(),
    value_bool: z.boolean().nullable().optional(),
    // The planner enforces the real limit (500) with the code `text_too_long`.
    value_text: l10nSchema(2000).nullable().optional(),
  })
  .strict()

export const AdminSetProductAttributesSchema = z
  .object({
    values: z.array(valueInputSchema).max(200),
    // The workflow enforces the real limit (500) with `search_keywords_too_long`.
    search_keywords: noControl(5000).nullable().optional(),
  })
  .strict()

const listQuerySchema = z.object({
  q: shortText.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type AdminCreateAttributeType = z.infer<typeof AdminCreateAttributeSchema>
export type AdminUpdateAttributeType = z.infer<typeof AdminUpdateAttributeSchema>
export type AdminOptionInputType = z.infer<typeof AdminOptionInputSchema>
export type AdminSetAttributeCategoriesType = z.infer<typeof AdminSetAttributeCategoriesSchema>
export type AdminSetProductAttributesType = z.infer<typeof AdminSetProductAttributesSchema>

/** Parses `?q&limit&offset` of the list route; a bad value is a 400. */
export function parseListQuery(query: Record<string, unknown>) {
  const parsed = listQuerySchema.safeParse({
    q: typeof query.q === "string" ? query.q : undefined,
    limit: query.limit,
    offset: query.offset,
  })
  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `invalid_query: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`
    )
  }
  return parsed.data
}
