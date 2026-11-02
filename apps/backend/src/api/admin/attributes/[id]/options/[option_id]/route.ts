import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireAttributeAdmin } from "../../../../../../lib/attribute-read"
import {
  deleteAttributeOptionWorkflow,
  upsertAttributeOptionWorkflow,
} from "../../../../../../workflows/attributes"
import type { AdminOptionInputType } from "../../../validators"

// POST /admin/attributes/:id/options/:option_id -> { attribute }
export async function POST(
  req: AuthenticatedMedusaRequest<AdminOptionInputType>,
  res: MedusaResponse
) {
  await upsertAttributeOptionWorkflow(req.scope).run({
    input: { ...req.validatedBody, attribute_id: req.params.id, id: req.params.option_id },
  })
  res.json({ attribute: await requireAttributeAdmin(req.scope, req.params.id) })
}

// DELETE /admin/attributes/:id/options/:option_id -> { attribute }
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteAttributeOptionWorkflow(req.scope).run({
    input: { id: req.params.option_id, attribute_id: req.params.id },
  })
  res.json({ attribute: await requireAttributeAdmin(req.scope, req.params.id) })
}
