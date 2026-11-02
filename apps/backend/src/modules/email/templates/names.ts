/**
 * The templates this provider can render. Kept apart from the React code on
 * purpose: this file loads without React, so an unknown template is refused
 * with `unknown_template` even where React cannot be loaded (render.ts).
 */
export const TEMPLATE_NAMES = [
  "password-reset",
  "order-confirmed",
  "order-shipped",
  "refund-issued",
  "staff-new-order",
  "custom-enquiry-received",
  "custom-enquiry-confirmation",
] as const

export type TemplateName = (typeof TEMPLATE_NAMES)[number]

export function isTemplateName(value: unknown): value is TemplateName {
  return typeof value === "string" && (TEMPLATE_NAMES as readonly string[]).includes(value)
}
