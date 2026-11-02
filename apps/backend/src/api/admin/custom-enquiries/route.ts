import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { CUSTOM_ENQUIRY_MODULE } from "../../../modules/custom-enquiry"
import { AdminListEnquiriesSchema } from "../../../modules/custom-enquiry/lib/rules"
import type CustomEnquiryModuleService from "../../../modules/custom-enquiry/service"

// GET /admin/custom-enquiries?limit=20&offset=0&status=new -> { custom_enquiries, count, limit, offset }, newest first
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = AdminListEnquiriesSchema.safeParse(req.query)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "limit, offset or status is not valid")
  }
  const { limit, offset, status } = parsed.data
  const service: CustomEnquiryModuleService = req.scope.resolve(CUSTOM_ENQUIRY_MODULE)
  const [custom_enquiries, count] = await service.listAndCountCustomEnquiries(status ? { status } : {}, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })
  res.json({ custom_enquiries, count, limit, offset })
}
