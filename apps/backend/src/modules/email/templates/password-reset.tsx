import { Button, Link, Section, Text } from "@react-email/components"
import { asObject, optText, reqUrl } from "./data"
import { EmailLayout, emailStyles } from "./layout"
import { storeName } from "./strings"
import type { TemplateDefinition } from "./types"

/** What the password-reset subscriber sends in `notification.data`. */
export type PasswordResetProps = {
  reset_url: string
  first_name?: string
  expires_minutes: number
}

const T = "password-reset"
const DEFAULT_EXPIRES_MINUTES = 15

function parseMinutes(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1440
    ? value
    : DEFAULT_EXPIRES_MINUTES
}

/** Control characters and runs of spaces carry nothing a greeting needs. */
function cleanName(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[\u0000-\u001f\u007f\u2028\u2029]/gu, " ").replace(/\s+/gu, " ").trim()
  return cleaned ? Array.from(cleaned).slice(0, 100).join("").trim() || undefined : undefined
}

function PasswordResetEmail({ reset_url, first_name, expires_minutes }: PasswordResetProps) {
  return (
    <EmailLayout preview={`Use this link to choose a new password. It works for ${expires_minutes} minutes.`}>
      <Text style={emailStyles.text}>{first_name ? `Hello ${first_name},` : "Hello,"}</Text>
      <Text style={emailStyles.text}>
        We received a request to reset the password of your {storeName()} account. Use the button below to choose a
        new password.
      </Text>
      <Text style={emailStyles.text}>The link works for {expires_minutes} minutes and can be used once.</Text>
      <Section style={{ margin: "20px 0" }}>
        <Button href={reset_url} style={emailStyles.button}>
          Choose a new password
        </Button>
      </Section>
      <Text style={emailStyles.small}>If the button does not work, copy this link into your browser:</Text>
      <Text style={emailStyles.small}>
        <Link href={reset_url} style={emailStyles.link}>
          {reset_url}
        </Link>
      </Text>
      <Text style={emailStyles.small}>
        If you did not ask for this, you can ignore this email. Your password will not change.
      </Text>
    </EmailLayout>
  )
}

export const passwordReset: TemplateDefinition<PasswordResetProps> = {
  parse(data) {
    const o = asObject(data)
    return {
      reset_url: reqUrl(T, o, "reset_url"),
      first_name: cleanName(optText(T, o, "first_name", 200)),
      expires_minutes: parseMinutes(o.expires_minutes),
    }
  },
  subject: () => `Reset your ${storeName()} password`,
  element: (props) => <PasswordResetEmail {...props} />,
}
