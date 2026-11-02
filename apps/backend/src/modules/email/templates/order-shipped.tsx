import { Button, Link, Section, Text } from "@react-email/components"
import { asObject, optArray, optStringList, optText, optUrl, reqText, reqUrl } from "./data"
import { EmailLayout, emailStyles } from "./layout"
import { AddressLines, ItemRows, parseItem, type EmailItem } from "./order-parts"
import { storeName } from "./strings"
import type { TemplateDefinition } from "./types"

export type TrackingEntry = { number: string; url?: string; carrier?: string }

export type OrderShippedProps = {
  order_display_id: string
  first_name?: string
  items: EmailItem[]
  tracking: TrackingEntry[]
  address_lines: string[]
  order_url: string
}

const T = "order-shipped"

function OrderShippedEmail(p: OrderShippedProps) {
  return (
    <EmailLayout preview={`Your order #${p.order_display_id} is on its way.`}>
      <Text style={emailStyles.heading}>Your order is on its way</Text>
      <Text style={emailStyles.text}>{p.first_name ? `Hello ${p.first_name},` : "Hello,"}</Text>
      <Text style={emailStyles.text}>
        Good news: order #{p.order_display_id} from {storeName()} has been shipped.
      </Text>
      <ItemRows items={p.items} />
      {p.tracking.length ? (
        <>
          <Text style={{ ...emailStyles.text, marginTop: "16px", marginBottom: "4px", fontWeight: "bold" }}>
            Tracking
          </Text>
          {p.tracking.map((t, i) => (
            <Text key={i} style={{ ...emailStyles.text, margin: "0 0 4px" }}>
              {t.carrier ? `${t.carrier}: ` : ""}
              {t.url ? (
                <Link href={t.url} style={emailStyles.link}>
                  {t.number}
                </Link>
              ) : (
                t.number
              )}
            </Text>
          ))}
        </>
      ) : null}
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
    </EmailLayout>
  )
}

export const orderShipped: TemplateDefinition<OrderShippedProps> = {
  parse(data) {
    const o = asObject(data)
    return {
      order_display_id: reqText(T, { v: String(o.order_display_id ?? "") }, "v", 40),
      first_name: optText(T, o, "first_name", 100),
      items: optArray(T, o, "items", 100).map((row) => parseItem(T, row)),
      tracking: optArray(T, o, "tracking", 20).map((row) => ({
        number: reqText(T, row, "number", 100),
        url: optUrl(T, row, "url", { httpsOnly: true }),
        carrier: optText(T, row, "carrier", 60),
      })),
      address_lines: optStringList(T, o, "address_lines", 8),
      order_url: reqUrl(T, o, "order_url"),
    }
  },
  subject: (p) => `Your ${storeName()} order #${p.order_display_id} has shipped`,
  element: (props) => <OrderShippedEmail {...props} />,
}
