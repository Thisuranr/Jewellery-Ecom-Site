import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CUSTOM_ENQUIRY_MODULE } from "../../../../modules/custom-enquiry"
import type CustomEnquiryModuleService from "../../../../modules/custom-enquiry/service"
import type { EnquiryStatus } from "../../../../modules/custom-enquiry/models/custom-enquiry"

// POST /admin/custom-enquiries/:id { status } -> { custom_enquiry }
export async function POST(req: AuthenticatedMedusaRequest<{ status: EnquiryStatus }>, res: MedusaResponse) {
  const service: CustomEnquiryModuleService = req.scope.resolve(CUSTOM_ENQUIRY_MODULE)
  const [existing] = await service.listCustomEnquiries({ id: req.params.id }, { take: 1 })
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Custom enquiry not found")
  }
  const custom_enquiry = await service.updateCustomEnquiries({ id: existing.id, status: req.validatedBody.status })
  res.json({ custom_enquiry })
}
