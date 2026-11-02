import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireAttributeAdmin } from "../../../../../lib/attribute-read"
import { setAttributeCategoriesWorkflow } from "../../../../../workflows/attributes"
import type { AdminSetAttributeCategoriesType } from "../../validators"

// POST /admin/attributes/:id/categories -> { attribute }. Replaces every link.
export async function POST(
  req: AuthenticatedMedusaRequest<AdminSetAttributeCategoriesType>,
  res: MedusaResponse
) {
  await setAttributeCategoriesWorkflow(req.scope).run({
    input: { attribute_id: req.params.id, categories: req.validatedBody.categories },
  })
  res.json({ attribute: await requireAttributeAdmin(req.scope, req.params.id) })
}
