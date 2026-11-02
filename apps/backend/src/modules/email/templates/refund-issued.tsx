import { Button, Section, Text } from "@react-email/components"
import { asObject, optText, reqText, reqUrl } from "./data"
import { EmailLayout, emailStyles } from "./layout"
import { storeName } from "./strings"
import type { TemplateDefinition } from "./types"

export type RefundIssuedProps = {
  order_display_id: string
  first_name?: string
  refund_str: string
  order_url: string
}

const T = "refund-issued"

function RefundIssuedEmail(p: RefundIssuedProps) {
  return (
    <EmailLayout preview={`We have refunded ${p.refund_str} for order #${p.order_display_id}.`}>
      <Text style={emailStyles.heading}>Your refund has been issued</Text>
      <Text style={emailStyles.text}>{p.first_name ? `Hello ${p.first_name},` : "Hello,"}</Text>
      <Text style={emailStyles.text}>
        We have refunded {p.refund_str} for order #{p.order_display_id} to your original payment method. It can take
        5 to 10 business days to appear on your statement, depending on your bank.
      </Text>
      <Section style={{ margin: "20px 0" }}>
        <Button href={p.order_url} style={emailStyles.button}>
          View your order
        </Button>
      </Section>
      <Text style={emailStyles.small}>Questions about this refund? Reply to this email and {storeName()} will help.</Text>
    </EmailLayout>
  )
}

export const refundIssued: TemplateDefinition<RefundIssuedProps> = {
  parse(data) {
    const o = asObject(data)
    return {
      order_display_id: reqText(T, { v: String(o.order_display_id ?? "") }, "v", 40),
      first_name: optText(T, o, "first_name", 100),
      refund_str: reqText(T, o, "refund_str", 40),
      order_url: reqUrl(T, o, "order_url"),
    }
  },
  subject: (p) => `Your ${storeName()} refund for order #${p.order_display_id}`,
  element: (props) => <RefundIssuedEmail {...props} />,
}
