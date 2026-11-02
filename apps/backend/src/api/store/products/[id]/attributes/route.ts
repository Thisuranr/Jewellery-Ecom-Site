import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadStoreProductAttributes, notShown } from "../../../../../lib/store-attributes"

// GET /store/products/:id/attributes -> { groups }
// The spec table of a published product in one of the key's sales channels.
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const groups = await loadStoreProductAttributes(
    req.scope,
    req.params.id,
    req.publishable_key_context?.sales_channel_ids ?? [],
    req.locale
  )
  if (!groups) {
    throw notShown("product_not_found", req.params.id)
  }
  res.json({ groups })
}
