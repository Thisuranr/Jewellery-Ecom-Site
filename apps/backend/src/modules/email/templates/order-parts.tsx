import { Column, Row, Section, Text } from "@react-email/components"
import { emailStyles } from "./layout"
import { optText, reqInt, reqText, type Obj } from "./data"

export type EmailItem = {
  title: string
  variant_title?: string
  quantity: number
  total_str: string
}

export function parseItem(template: string, row: Obj): EmailItem {
  return {
    title: reqText(template, row, "title"),
    variant_title: optText(template, row, "variant_title"),
    quantity: reqInt(template, row, "quantity"),
    total_str: reqText(template, row, "total_str", 40),
  }
}

export function ItemRows({ items }: { items: EmailItem[] }) {
  return (
    <Section>
      {items.map((item, i) => (
        <Row key={i}>
          <Column style={emailStyles.cell}>
            {item.title}
            {item.variant_title ? ` (${item.variant_title})` : ""} x {item.quantity}:
          </Column>
          <Column style={{ ...emailStyles.cell, ...emailStyles.right }}>{"\u00A0"}{item.total_str}</Column>
        </Row>
      ))}
    </Section>
  )
}

export function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const style = bold ? { ...emailStyles.cell, fontWeight: "bold" as const } : emailStyles.cell
  return (
    <Row>
      <Column style={style}>{label}:</Column>
      <Column style={{ ...style, ...emailStyles.right }}>{"\u00A0"}{value}</Column>
    </Row>
  )
}

export function AddressLines({ lines }: { lines: string[] }) {
  return (
    <Text style={emailStyles.text}>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </Text>
  )
}
