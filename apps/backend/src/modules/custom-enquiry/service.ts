import { MedusaService } from "@medusajs/framework/utils"
import CustomEnquiry from "./models/custom-enquiry"

class CustomEnquiryModuleService extends MedusaService({ CustomEnquiry }) {}

export default CustomEnquiryModuleService
