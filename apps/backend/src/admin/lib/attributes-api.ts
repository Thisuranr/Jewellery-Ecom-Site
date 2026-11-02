import type { CategorySummary } from "./category-paths"
import { sdk } from "./sdk"
import type { Attribute, CategoryAttribute, ProductAttribute } from "./types"

/** Bodies of the attributes admin API (plan M1 B4). */

export type L10nBody = { en: string }
export type TitleBody = { en?: string | null }

export type OptionBody = {
  handle: string
  label: L10nBody
  title_label?: TitleBody | null
  rank?: number
  swatch_hex?: string | null
}

export type CreateAttributeBody = {
  handle: string
  type: string
  unit?: string | null
  group_handle?: string | null
  filterable?: boolean
  required?: boolean
  rank?: number
  label: L10nBody
  options?: OptionBody[]
}

export type UpdateAttributeBody = Partial<Omit<CreateAttributeBody, "handle" | "type" | "options">>

export type CategoryLinkBody = {
  category_id: string
  rank?: number
  required_override?: boolean | null
}

export type ProductValueBody = {
  attribute_id: string
  option_ids?: string[]
  value_number?: number | null
  value_bool?: boolean | null
  value_text?: L10nBody | null
}

type ProductAttributesResponse = { attributes: ProductAttribute[]; search_keywords: string }

const json = (method: "POST" | "DELETE", body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body }),
})

export const attributesApi = {
  list: (query: { q?: string; limit: number; offset: number }) =>
    sdk.client.fetch<{ attributes: Attribute[]; count: number; limit: number; offset: number }>(
      "/admin/attributes",
      { query }
    ),
  retrieve: (id: string) =>
    sdk.client.fetch<{ attribute: Attribute }>(`/admin/attributes/${id}`),
  create: (body: CreateAttributeBody) =>
    sdk.client.fetch<{ attribute: Attribute }>("/admin/attributes", json("POST", body)),
  update: (id: string, body: UpdateAttributeBody) =>
    sdk.client.fetch<{ attribute: Attribute }>(`/admin/attributes/${id}`, json("POST", body)),
  remove: (id: string) =>
    sdk.client.fetch<{ id: string; deleted: boolean }>(`/admin/attributes/${id}`, json("DELETE")),
  createOption: (id: string, body: OptionBody) =>
    sdk.client.fetch<{ attribute: Attribute }>(`/admin/attributes/${id}/options`, json("POST", body)),
  updateOption: (id: string, optionId: string, body: OptionBody) =>
    sdk.client.fetch<{ attribute: Attribute }>(
      `/admin/attributes/${id}/options/${optionId}`,
      json("POST", body)
    ),
  removeOption: (id: string, optionId: string) =>
    sdk.client.fetch<{ attribute: Attribute }>(
      `/admin/attributes/${id}/options/${optionId}`,
      json("DELETE")
    ),
  setCategories: (id: string, categories: CategoryLinkBody[]) =>
    sdk.client.fetch<{ attribute: Attribute }>(
      `/admin/attributes/${id}/categories`,
      json("POST", { categories })
    ),
  /** The category's effective attributes: its own links and its ancestors' (B4). */
  categoryAttributes: (categoryId: string) =>
    sdk.client.fetch<{ attributes: CategoryAttribute[] }>(
      `/admin/product-categories/${categoryId}/attributes`
    ),
  productAttributes: (productId: string) =>
    sdk.client.fetch<ProductAttributesResponse>(`/admin/products/${productId}/attributes`),
  saveProductAttributes: (
    productId: string,
    body: { values: ProductValueBody[]; search_keywords?: string | null }
  ) =>
    sdk.client.fetch<ProductAttributesResponse>(
      `/admin/products/${productId}/attributes`,
      json("POST", body)
    ),
}

/** All categories (a shop has a few dozen), for the category pickers. */
export async function listCategories(): Promise<CategorySummary[]> {
  const response = await sdk.admin.productCategory.list({
    limit: 200,
    fields: "id,name,handle,parent_category_id",
  })
  return response.product_categories.map((category) => ({
    id: category.id,
    name: category.name,
    handle: category.handle,
    parent_category_id: category.parent_category_id ?? null,
  }))
}
