/** Shapes of the attributes admin API (plan M1 B4), as the admin pages use them. */

export type L10nRead = { en: string | null; si?: string | null; ta?: string | null }

export type AttributeType = "text" | "number" | "boolean" | "select" | "multiselect"

export const ATTRIBUTE_TYPES: { value: AttributeType; label: string }[] = [
  { value: "select", label: "Select (one option)" },
  { value: "multiselect", label: "Multiselect (several options)" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / no" },
  { value: "text", label: "Text" },
]

export const ATTRIBUTE_UNITS = ["mm", "cm", "m", "in", "g", "kg", "ct", "months", "days"] as const

export type AttributeOption = {
  id: string
  handle: string
  rank: number
  swatch_hex: string | null
  label: L10nRead
  title_label: L10nRead | null
}

export type AttributeCategoryLink = {
  category_id: string
  rank: number
  required_override: boolean | null
}

export type Attribute = {
  id: string
  handle: string
  type: AttributeType
  unit: string | null
  group_handle: string | null
  filterable: boolean
  required: boolean
  rank: number
  label: L10nRead
  options: AttributeOption[]
  categories: AttributeCategoryLink[]
  value_count: number
}

/**
 * What the Quick add page needs of a row of GET /admin/product-categories/:id/attributes
 * (the category's effective attributes; the route also sends the link and count fields).
 */
export type CategoryAttribute = Pick<
  Attribute,
  "id" | "handle" | "type" | "unit" | "group_handle" | "required" | "rank" | "label" | "options"
>

export type ProductAttributeValue = {
  option_ids: string[]
  value_number: number | null
  value_bool: boolean | null
  value_text: L10nRead | null
}

export type ProductAttribute = Attribute & {
  source_category_id: string
  value: ProductAttributeValue | null
}

/** Text as the forms edit it (English only; empty string = none). */
export type L10nForm = { en: string }

export const emptyL10n = (): L10nForm => ({ en: "" })

export const toL10nForm = (value: L10nRead | null | undefined): L10nForm => ({
  en: value?.en ?? "",
})

/** The request body form of an L10n. */
export const fromL10nForm = (value: L10nForm) => ({
  en: value.en.trim(),
})
