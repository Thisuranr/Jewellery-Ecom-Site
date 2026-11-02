import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export type ProductAttributeOption = {
  handle: string
  label: string
  swatch_hex: string | null
}

export type ProductAttribute = {
  handle: string
  label: string
  type: string
  unit: string | null
  value: string | number | boolean | ProductAttributeOption[]
}

export type ProductAttributeGroup = {
  handle: string
  attributes: ProductAttribute[]
}

/**
 * A product's attribute values, grouped (`GET /store/products/:id/attributes`).
 * Cached like the product list. A failure returns no groups, so the product
 * page still renders without its details.
 */
export const retrieveProductAttributes = async (
  productId: string
): Promise<ProductAttributeGroup[]> => {
  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ groups: ProductAttributeGroup[] }>(
      `/store/products/${productId}/attributes`,
      { method: "GET", next, cache: "force-cache" }
    )
    .then(({ groups }) => groups ?? [])
    .catch(() => [])
}
