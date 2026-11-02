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

/** To the customer: we received your request. */
export type CustomEnquiryConfirmationProps = { name: string; message: string }

const TC = "custom-enquiry-confirmation"

function ConfirmationEmail(p: CustomEnquiryConfirmationProps) {
  return (
    <EmailLayout preview="We have received your custom order request.">
      <Text style={emailStyles.heading}>We received your request</Text>
      <Text style={emailStyles.text}>Hello {p.name},</Text>
      <Text style={emailStyles.text}>
        Thank you for getting in touch with {storeName()}. We have received your custom order request and will reply
        by email as soon as we can. For your records, here is what you sent us:
      </Text>
      <Lines text={p.message} />
    </EmailLayout>
  )
}

export const customEnquiryConfirmation: TemplateDefinition<CustomEnquiryConfirmationProps> = {
  parse(data) {
    const o = asObject(data)
    return { name: reqText(TC, o, "name", 200), message: reqText(TC, o, "message", 5000) }
  },
  subject: () => `We received your custom order request - ${storeName()}`,
  element: (props) => <ConfirmationEmail {...props} />,
}
