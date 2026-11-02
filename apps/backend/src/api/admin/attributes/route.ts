import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAttributesAdmin, requireAttributeAdmin } from "../../../lib/attribute-read"
import { createAttributeWorkflow } from "../../../workflows/attributes"
import { AdminCreateAttributeType, parseListQuery } from "./validators"

// GET /admin/attributes?q&limit=50&offset=0 -> { attributes, count }
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { q, limit, offset } = parseListQuery(req.query)
  const { attributes, count } = await listAttributesAdmin(req.scope, { q, limit, offset })
  res.json({ attributes, count, limit, offset })
}

// POST /admin/attributes -> { attribute }
export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateAttributeType>,
  res: MedusaResponse
) {
  const { result } = await createAttributeWorkflow(req.scope).run({ input: req.validatedBody })
  res.json({ attribute: await requireAttributeAdmin(req.scope, result.id) })
}
