import { Body, Container, Head, Hr, Html, Preview, Text } from "@react-email/components"
import type { CSSProperties, ReactNode } from "react"
import { storeName } from "./strings"

export const FONT_STACK = 'Georgia,"Times New Roman",serif'
export const LINE_HEIGHT = 1.6

export const emailStyles = {
  body: {
    margin: 0,
    padding: "24px 12px",
    backgroundColor: "#f6f4f1",
    fontFamily: FONT_STACK,
    lineHeight: LINE_HEIGHT,
    color: "#2b2b2b",
  } satisfies CSSProperties,
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "28px 28px 20px",
    backgroundColor: "#ffffff",
    borderRadius: "6px",
  } satisfies CSSProperties,
  heading: {
    margin: "0 0 16px",
    fontFamily: FONT_STACK,
    fontSize: "22px",
    lineHeight: 1.3,
    color: "#2b2b2b",
  } satisfies CSSProperties,
  text: {
    margin: "0 0 14px",
    fontFamily: FONT_STACK,
    fontSize: "16px",
    lineHeight: LINE_HEIGHT,
    color: "#2b2b2b",
  } satisfies CSSProperties,
  button: {
    display: "inline-block",
    padding: "13px 24px",
    backgroundColor: "#2b2b2b",
    color: "#ffffff",
    borderRadius: "4px",
    fontFamily: FONT_STACK,
    fontSize: "16px",
    textDecoration: "none",
  } satisfies CSSProperties,
  link: { color: "#2b2b2b", wordBreak: "break-all" } satisfies CSSProperties,
  small: {
    margin: "0 0 14px",
    fontFamily: FONT_STACK,
    fontSize: "14px",
    lineHeight: LINE_HEIGHT,
    color: "#666666",
  } satisfies CSSProperties,
  hr: { margin: "20px 0 12px", borderColor: "#e5e2dd" } satisfies CSSProperties,
  cell: { padding: "4px 0", fontFamily: FONT_STACK, fontSize: "15px", verticalAlign: "top" } satisfies CSSProperties,
  right: { textAlign: "right", whiteSpace: "nowrap" } satisfies CSSProperties,
}

export type EmailLayoutProps = {
  /** The inbox preview line; hidden in the body. */
  preview: string
  children: ReactNode
}

/** The frame every email shares: the document language, the inbox preview, one white card, the store name at the foot. */
export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en-AU" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          {children}
          <Hr style={emailStyles.hr} />
          <Text style={emailStyles.small}>{storeName()}</Text>
        </Container>
      </Body>
    </Html>
  )
}
