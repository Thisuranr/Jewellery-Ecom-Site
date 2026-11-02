import { Text } from "@react-email/components"
import { asObject, optText, reqText } from "./data"
import { EmailLayout, emailStyles } from "./layout"
import { storeName } from "./strings"
import type { TemplateDefinition } from "./types"

/** To the store: a custom order enquiry arrived. Every field the customer typed. */
export type CustomEnquiryReceivedProps = {
  name: string
  email: string
  phone?: string
  budget?: string
  message: string
}

const T = "custom-enquiry-received"

/** Keeps line breaks in the customer's message. */
function Lines({ text }: { text: string }) {
  const lines = text.split(/\r?\n/u)
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

function ReceivedEmail(p: CustomEnquiryReceivedProps) {
  return (
    <EmailLayout preview={`Custom order enquiry from ${p.name}.`}>
      <Text style={emailStyles.heading}>New custom order enquiry</Text>
      <Text style={{ ...emailStyles.text, margin: "0 0 4px" }}>Name: {p.name}</Text>
      <Text style={{ ...emailStyles.text, margin: "0 0 4px" }}>Email: {p.email}</Text>
      <Text style={{ ...emailStyles.text, margin: "0 0 4px" }}>Phone: {p.phone ?? "not given"}</Text>
      <Text style={{ ...emailStyles.text, margin: "0 0 14px" }}>Budget: {p.budget ?? "not given"}</Text>
      <Text style={{ ...emailStyles.text, margin: "0 0 4px", fontWeight: "bold" }}>Message</Text>
      <Lines text={p.message} />
      <Text style={emailStyles.small}>Reply to this email to answer the customer directly.</Text>
    </EmailLayout>
  )
}

export const customEnquiryReceived: TemplateDefinition<CustomEnquiryReceivedProps> = {
  parse(data) {
    const o = asObject(data)
    return {
      name: reqText(T, o, "name", 200),
      email: reqText(T, o, "email", 254),
      phone: optText(T, o, "phone", 100),
      budget: optText(T, o, "budget", 200),
      message: reqText(T, o, "message", 5000),
    }
  },
  subject: (p) => `Custom order enquiry from ${p.name.replace(/[\r\n]+/gu, " ").slice(0, 80)}`,
  element: (props) => <ReceivedEmail {...props} />,
}

/**
 * To the customer: we received your request. Deliberately generic: it never repeats the name or message the
 * visitor typed, so the form cannot be used to send chosen text (or links) to someone else's inbox.
 */
export type CustomEnquiryConfirmationProps = Record<string, never>

function ConfirmationEmail() {
  return (
    <EmailLayout preview="We have received your custom order request.">
      <Text style={emailStyles.heading}>We received your request</Text>
      <Text style={emailStyles.text}>Hi there,</Text>
      <Text style={emailStyles.text}>
        We received your custom order request at {storeName()} and will reply within 2 business days. If you did not
        send a request, you can ignore this email.
      </Text>
    </EmailLayout>
  )
}

export const customEnquiryConfirmation: TemplateDefinition<CustomEnquiryConfirmationProps> = {
  parse() {
    return {}
  },
  subject: () => `We received your custom order request - ${storeName()}`,
  element: () => <ConfirmationEmail />,
}
