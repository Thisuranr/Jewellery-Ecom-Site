import { Button, Section, Text } from "@react-email/components"
import { asObject, optStringList, reqArray, reqText, reqUrl } from "./data"
import { EmailLayout, emailStyles } from "./layout"
import { ItemRows, parseItem, TotalRow, type EmailItem } from "./order-parts"
import { storeName } from "./strings"
import type { TemplateDefinition } from "./types"

/** The "new order" alert to the store owner. */
export type StaffNewOrderProps = {
  order_display_id: string
  customer_name?: string
  customer_email: string
  items: EmailItem[]
  total_str: string
  gst_included_str: string
  address_lines: string[]
  admin_url: string
}

const T = "staff-new-order"

function StaffNewOrderEmail(p: StaffNewOrderProps) {
  return (
    <EmailLayout preview={`New order #${p.order_display_id}, ${p.total_str}.`}>
      <Text style={emailStyles.heading}>New order #{p.order_display_id}</Text>
      <Text style={emailStyles.text}>
        {p.customer_name ? `${p.customer_name} (${p.customer_email})` : p.customer_email} has placed an order on{" "}
        {storeName()}.
      </Text>
      <ItemRows items={p.items} />
      <Section style={{ marginTop: "12px" }}>
        <TotalRow label="Total (AUD)" value={p.total_str} bold />
        <TotalRow label="Includes GST of" value={p.gst_included_str} />
      </Section>
      {p.address_lines.length ? (
        <Text style={{ ...emailStyles.text, marginTop: "16px" }}>Ship to: {p.address_lines.join(", ")}</Text>
      ) : null}
      <Section style={{ margin: "20px 0" }}>
        <Button href={p.admin_url} style={emailStyles.button}>
          Open in admin
        </Button>
      </Section>
    </EmailLayout>
  )
}

export const staffNewOrder: TemplateDefinition<StaffNewOrderProps> = {
  parse(data) {
    const o = asObject(data)
    return {
      order_display_id: reqText(T, { v: String(o.order_display_id ?? "") }, "v", 40),
      customer_name: typeof o.customer_name === "string" && o.customer_name.trim() ? o.customer_name.trim().slice(0, 200) : undefined,
      customer_email: reqText(T, o, "customer_email", 254),
      items: reqArray(T, o, "items", 100).map((row) => parseItem(T, row)),
      total_str: reqText(T, o, "total_str", 40),
      gst_included_str: reqText(T, o, "gst_included_str", 40),
      address_lines: optStringList(T, o, "address_lines", 8),
      admin_url: reqUrl(T, o, "admin_url"),
    }
  },
  subject: (p) => `New order #${p.order_display_id} (${p.total_str})`,
  element: (props) => <StaffNewOrderEmail {...props} />,
}
