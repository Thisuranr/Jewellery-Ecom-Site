import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { customOrderEmail } from "../../../lib/custom-order-email"
import { logFailure, sendEmail } from "../../../lib/send-email"
import { CUSTOM_ENQUIRY_MODULE } from "../../../modules/custom-enquiry"
import {
  isHoneypotTripped,
  isThrottled,
  throttleWindowStart,
  type StoreCreateEnquiryType,
} from "../../../modules/custom-enquiry/lib/rules"
import type CustomEnquiryModuleService from "../../../modules/custom-enquiry/service"

const THROTTLED_MESSAGE =
  "You have sent a few requests recently. Please wait a little while before sending another, or email us directly."

// POST /store/custom-enquiries -> { success: true }
// Never echoes what was stored. A filled honeypot gets the same answer and stores nothing.
export async function POST(req: MedusaRequest<StoreCreateEnquiryType>, res: MedusaResponse) {
  const body = req.validatedBody
  if (isHoneypotTripped(body)) {
    return res.json({ success: true })
  }

  const service: CustomEnquiryModuleService = req.scope.resolve(CUSTOM_ENQUIRY_MODULE)
  // Compare addresses in lower case, so A@x.com and a@x.com share one allowance.
  const email = body.email.toLowerCase()
  const [, recent] = await service.listAndCountCustomEnquiries(
    { email, created_at: { $gte: throttleWindowStart() } },
    { take: 1 }
  )
  if (isThrottled(recent)) {
    return res.status(429).json({ type: "too_many_requests", message: THROTTLED_MESSAGE })
  }

  const enquiry = await service.createCustomEnquiries({
    name: body.name,
    email,
    phone: body.phone ?? null,
    message: body.message,
    budget: body.budget ?? null,
  })

  // The enquiry is saved. A failed email is logged and never loses it.
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  await logFailure(req.scope, `the custom enquiry email for ${enquiry.id} to the store`, () =>
    sendEmail(req.scope, {
      to: customOrderEmail(),
      template: "custom-enquiry-received",
      replyTo: email,
      data: { name: body.name, email, phone: body.phone, budget: body.budget, message: body.message },
    })
  )
  await logFailure(req.scope, `the custom enquiry confirmation for ${enquiry.id} to the customer`, () =>
    sendEmail(req.scope, {
      to: email,
      template: "custom-enquiry-confirmation",
      data: { name: body.name, message: body.message },
    })
  )
  logger.info(`[custom-enquiry] saved ${enquiry.id}`)

  return res.json({ success: true })
}
