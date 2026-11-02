import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadStoreCategoryAttributes, notShown } from "../../../../../lib/store-attributes"

// GET /store/product-categories/:id/attributes -> { attributes }
// The filterable attributes of an active, non-internal category, localised
// (?locale= or x-medusa-locale), each with the facet the search API filters on.
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const attributes = await loadStoreCategoryAttributes(req.scope, req.params.id, req.locale)
  if (!attributes) {
    throw notShown("category_not_found", req.params.id)
  }
  res.json({ attributes })
}
