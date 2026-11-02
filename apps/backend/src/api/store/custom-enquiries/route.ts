import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { customOrderEmail } from "../../../lib/custom-order-email"
import { logFailure, sendEmail } from "../../../lib/send-email"
import { CUSTOM_ENQUIRY_MODULE } from "../../../modules/custom-enquiry"
import {
  hourlyCap,
  isHoneypotTripped,
  isOverCap,
  isThrottled,
  throttleWindowStart,
  type StoreCreateEnquiryType,
} from "../../../modules/custom-enquiry/lib/rules"
import { normalizeEmail } from "../../../modules/custom-enquiry/lib/normalize-email"
import type CustomEnquiryModuleService from "../../../modules/custom-enquiry/service"

const THROTTLED_MESSAGE =
  "You have sent a few requests recently. Please wait a little while before sending another, or email us directly."
const BUSY_MESSAGE =
  "We are receiving a lot of requests right now. Please email us directly and we will get back to you."

/** One lock for the whole count-then-insert, so parallel requests cannot all pass the check. */
const LOCK_KEY = "custom-enquiry:create"

// POST /store/custom-enquiries -> { success: true }
// Never echoes what was stored. A filled honeypot gets the same answer and stores nothing.
export async function POST(req: MedusaRequest<StoreCreateEnquiryType>, res: MedusaResponse) {
  const body = req.validatedBody
  if (isHoneypotTripped(body)) {
    return res.json({ success: true })
  }

  const service: CustomEnquiryModuleService = req.scope.resolve(CUSTOM_ENQUIRY_MODULE)
  const locking = req.scope.resolve(Modules.LOCKING)
  // Compare addresses in lower case, so A@x.com and a@x.com share one allowance; "+tag" and Gmail dots
  // are removed too, so one inbox cannot use many spellings.
  const email = body.email.toLowerCase()
  const emailNormalized = normalizeEmail(body.email)

  // Count and insert under one lock, so parallel requests cannot all pass the check.
  const outcome = await locking.execute(
    LOCK_KEY,
    async () => {
      const since = { $gte: throttleWindowStart() }
      const [, total] = await service.listAndCountCustomEnquiries({ created_at: since }, { take: 1 })
      if (isOverCap(total, hourlyCap())) {
        return { kind: "busy" } as const
      }
      const [, recent] = await service.listAndCountCustomEnquiries(
        { email_normalized: emailNormalized, created_at: since },
        { take: 1 }
      )
      if (isThrottled(recent)) {
        return { kind: "throttled" } as const
      }
      const created = await service.createCustomEnquiries({
        name: body.name,
        email,
        email_normalized: emailNormalized,
        phone: body.phone ?? null,
        message: body.message,
        budget: body.budget ?? null,
      })
      return { kind: "created", enquiry: created } as const
    },
    { timeout: 10 }
  )
  if (outcome.kind === "busy") {
    return res.status(429).json({ type: "too_many_requests", message: BUSY_MESSAGE })
  }
  if (outcome.kind === "throttled") {
    return res.status(429).json({ type: "too_many_requests", message: THROTTLED_MESSAGE })
  }
  const enquiry = outcome.enquiry

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
      data: {},
    })
  )
  logger.info(`[custom-enquiry] saved ${enquiry.id}`)

  return res.json({ success: true })
}
