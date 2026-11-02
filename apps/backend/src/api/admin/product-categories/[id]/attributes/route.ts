import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadCategoryAttributesAdmin } from "../../../../../lib/attribute-read"

// GET /admin/product-categories/:id/attributes -> { attributes }
// The category's effective attributes: its own links and its ancestors'.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ attributes: await loadCategoryAttributesAdmin(req.scope, req.params.id) })
}
