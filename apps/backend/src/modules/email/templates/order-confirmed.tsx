import { Button, Section, Text } from "@react-email/components"
import { EMAIL_ERROR, emailError } from "../lib/errors"
import { asObject, optStringList, optText, reqArray, reqText, reqUrl } from "./data"
import { EmailLayout, emailStyles } from "./layout"
import { AddressLines, ItemRows, parseItem, TotalRow, type EmailItem } from "./order-parts"
import { storeAbn, storeName } from "./strings"
import type { TemplateDefinition } from "./types"

/**
 * The customer's receipt, sent when an order is placed (Stripe payment captured). Amounts
 * arrive as ready-made strings ("$49.00"); prices include 10% GST, shown as
 * "Includes GST of $x". The subscriber builds the strings and the order link.
 */
export type OrderConfirmedProps = {
  order_display_id: string
  order_date: string
  first_name?: string
  items: EmailItem[]
  subtotal_str: string
  discount_str?: string
  shipping_str: string
  total_str: string
  gst_included_str: string
  address_lines: string[]
  order_url: string
}

const T = "order-confirmed"
const MAX_LINES = 8

function OrderConfirmedEmail(p: OrderConfirmedProps) {
  return (
    <EmailLayout preview={`Tax invoice for your order #${p.order_display_id}. Total ${p.total_str}.`}>
      <Text style={emailStyles.heading}>Tax invoice</Text>
      <Text style={{ ...emailStyles.small, marginBottom: "16px" }}>
        {storeName()}
        {storeAbn() ? <br /> : null}
        {storeAbn() ? `ABN ${storeAbn()}` : null}
      </Text>
      <Text style={emailStyles.text}>{p.first_name ? `Hello ${p.first_name},` : "Hello,"}</Text>
      <Text style={emailStyles.text}>
        Thank you for your order. We have received your order and your payment. Your order number is #{p.order_display_id}, placed on{" "}
        {p.order_date}.
      </Text>
      <ItemRows items={p.items} />
      <Section style={{ marginTop: "12px" }}>
        <TotalRow label="Subtotal" value={p.subtotal_str} />
        {p.discount_str ? <TotalRow label="Discount" value={p.discount_str} /> : null}
        <TotalRow label="Shipping" value={p.shipping_str} />
        <TotalRow label="Total (AUD)" value={p.total_str} bold />
        <TotalRow label="Includes GST of" value={p.gst_included_str} />
      </Section>
      {p.address_lines.length ? (
        <>
          <Text style={{ ...emailStyles.text, marginTop: "16px", marginBottom: "4px", fontWeight: "bold" }}>
            Shipping to
          </Text>
          <AddressLines lines={p.address_lines} />
        </>
      ) : null}
      <Section style={{ margin: "20px 0" }}>
        <Button href={p.order_url} style={emailStyles.button}>
          View your order
        </Button>
      </Section>
      <Text style={emailStyles.small}>
        We will email you again when your order ships. Questions? Reply to this email.
      </Text>
    </EmailLayout>
  )
}

export const orderConfirmed: TemplateDefinition<OrderConfirmedProps> = {
  parse(data) {
    const o = asObject(data)
    const items = reqArray(T, o, "items", 100).map((row) => parseItem(T, row))
    if (!items.length) {
      throw emailError(EMAIL_ERROR.invalidTemplateData, `${T} needs items`)
    }
    return {
      order_display_id: reqText(T, { v: String(o.order_display_id ?? "") }, "v", 40),
      order_date: reqText(T, o, "order_date", 60),
      first_name: optText(T, o, "first_name", 100),
      items,
      subtotal_str: reqText(T, o, "subtotal_str", 40),
      discount_str: optText(T, o, "discount_str", 40),
      shipping_str: reqText(T, o, "shipping_str", 40),
      total_str: reqText(T, o, "total_str", 40),
      gst_included_str: reqText(T, o, "gst_included_str", 40),
      address_lines: optStringList(T, o, "address_lines", MAX_LINES),
      order_url: reqUrl(T, o, "order_url"),
    }
  },
  subject: (p) => `Your ${storeName()} order #${p.order_display_id} is confirmed`,
  element: (props) => <OrderConfirmedEmail {...props} />,
}
