import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requireAttributeAdmin } from "../../../../lib/attribute-read"
import { deleteAttributeWorkflow, updateAttributeWorkflow } from "../../../../workflows/attributes"
import type { AdminUpdateAttributeType } from "../validators"

// GET /admin/attributes/:id -> { attribute }
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ attribute: await requireAttributeAdmin(req.scope, req.params.id) })
}

// POST /admin/attributes/:id -> { attribute }. `handle` and `type` are refused
// by the workflow (handle_immutable / type_immutable).
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateAttributeType>,
  res: MedusaResponse
) {
  await updateAttributeWorkflow(req.scope).run({
    input: { ...req.validatedBody, id: req.params.id },
  })
  res.json({ attribute: await requireAttributeAdmin(req.scope, req.params.id) })
}

// DELETE /admin/attributes/:id -> { id, object: "attribute", deleted: true }
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteAttributeWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json(result)
}
