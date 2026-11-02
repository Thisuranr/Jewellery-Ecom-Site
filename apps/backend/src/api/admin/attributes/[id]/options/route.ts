import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireAttributeAdmin } from "../../../../../lib/attribute-read"
import { upsertAttributeOptionWorkflow } from "../../../../../workflows/attributes"
import type { AdminOptionInputType } from "../../validators"

// POST /admin/attributes/:id/options -> { attribute }
export async function POST(
  req: AuthenticatedMedusaRequest<AdminOptionInputType>,
  res: MedusaResponse
) {
  await upsertAttributeOptionWorkflow(req.scope).run({
    input: { ...req.validatedBody, attribute_id: req.params.id },
  })
  res.json({ attribute: await requireAttributeAdmin(req.scope, req.params.id) })
}
