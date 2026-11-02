import { z } from "@medusajs/framework/zod"
import { ENQUIRY_STATUSES } from "../models/custom-enquiry"

/** At most this many enquiries from one email address inside the window. */
export const MAX_ENQUIRIES_PER_EMAIL = 3
export const THROTTLE_WINDOW_MS = 60 * 60 * 1000

/** Where the throttle window starts for a request made at `now`. */
export function throttleWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - THROTTLE_WINDOW_MS)
}

/** True when `recentCount` enquiries in the window already use up the allowance (the next one is refused). */
export function isThrottled(recentCount: number): boolean {
  return recentCount >= MAX_ENQUIRIES_PER_EMAIL
}

// Text fields are trimmed first, so "   " is empty and a padded value is measured without its padding.
const trimmed = z.string().trim()
/** An optional text: absent, null or blank becomes undefined. */
const optional = (max: number) =>
  z
    .union([trimmed.max(max), z.null()])
    .optional()
    .transform((v) => (v ? v : undefined))

/**
 * The storefront form. `website` is the honeypot: real visitors never see it, so a non-empty value
 * means a bot (the route answers 200 and stores nothing). It is only length-limited here so a bot
 * can never make the request fail and learn which field tripped.
 */
export const StoreCreateEnquirySchema = z.object({
  name: trimmed.min(1).max(100),
  email: trimmed.max(254).pipe(z.email()),
  phone: optional(30),
  message: trimmed.min(10).max(2000),
  budget: optional(100),
  website: z.string().max(10_000).optional(),
})
export type StoreCreateEnquiryType = z.infer<typeof StoreCreateEnquirySchema>

export function isHoneypotTripped(body: { website?: string }): boolean {
  return typeof body.website === "string" && body.website.trim() !== ""
}

export const AdminListEnquiriesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(ENQUIRY_STATUSES).optional(),
})

export const AdminUpdateEnquirySchema = z.object({ status: z.enum(ENQUIRY_STATUSES) }).strict()
