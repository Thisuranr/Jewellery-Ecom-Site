import { customEnquiryConfirmation, customEnquiryReceived } from "./custom-enquiry"
import { orderConfirmed } from "./order-confirmed"
import { orderShipped } from "./order-shipped"
import { passwordReset } from "./password-reset"
import { refundIssued } from "./refund-issued"
import { staffNewOrder } from "./staff-new-order"
import type { TemplateName } from "./names"
import type { TemplateDefinition } from "./types"

/**
 * Template name to definition. This module (and everything it imports) loads
 * React, so only render.ts requires it, and only when an email is rendered.
 */
export const templates: { [Name in TemplateName]: TemplateDefinition<any> } = {
  "password-reset": passwordReset,
  "order-confirmed": orderConfirmed,
  "order-shipped": orderShipped,
  "refund-issued": refundIssued,
  "staff-new-order": staffNewOrder,
  "custom-enquiry-received": customEnquiryReceived,
  "custom-enquiry-confirmation": customEnquiryConfirmation,
}
