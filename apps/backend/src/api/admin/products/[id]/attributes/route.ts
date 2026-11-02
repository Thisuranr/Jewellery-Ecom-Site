import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { loadProductAttributesAdmin } from "../../../../../lib/attribute-read"
import { setProductAttributesWorkflow } from "../../../../../workflows/attributes"
import type { AdminSetProductAttributesType } from "../../../attributes/validators"

// GET /admin/products/:id/attributes -> { attributes, search_keywords }
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await loadProductAttributesAdmin(req.scope, req.params.id))
}

// POST /admin/products/:id/attributes -> the same as GET, after saving.
export async function POST(
  req: AuthenticatedMedusaRequest<AdminSetProductAttributesType>,
  res: MedusaResponse
) {
  await setProductAttributesWorkflow(req.scope).run({
    input: { ...req.validatedBody, product_id: req.params.id },
  })
  res.json(await loadProductAttributesAdmin(req.scope, req.params.id))
}
