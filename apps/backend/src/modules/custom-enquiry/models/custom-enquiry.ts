import { model } from "@medusajs/framework/utils"

export const ENQUIRY_STATUSES = ["new", "contacted", "closed"] as const
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]

/** A "custom order" request from the storefront form. The store answers by email. */
const CustomEnquiry = model
  .define("custom_enquiry", {
    id: model.id({ prefix: "enq" }).primaryKey(),
    name: model.text(),
    email: model.text(),
    /** The inbox key used for throttling (lower case, +tag and Gmail dots removed). */
    email_normalized: model.text().default(""),
    phone: model.text().nullable(),
    message: model.text(),
    budget: model.text().nullable(),
    status: model.enum([...ENQUIRY_STATUSES]).default("new"),
  })
  .indexes([{ on: ["email", "created_at"] }, { on: ["email_normalized", "created_at"] }])

export default CustomEnquiry
