// Small, strict address checks for the email provider. They are not a full
// RFC 5322 parser; their job is to refuse what must never reach a mail header
// (line breaks, control characters) and obvious typos in configuration.

const MAX_ADDRESS = 254
const MAX_MAILBOX = 320

// Control characters, including CR and LF, and the Unicode line and paragraph
// separators (header injection).
const FORBIDDEN = /[\u0000-\u001f\u007f\u2028\u2029]/

const PLAIN = /^[^\s<>()[\]\\,;:"@]+@[^\s<>()[\]\\,;:"@]+\.[^\s<>()[\]\\,;:"@]+$/u
const NAMED = /^([^<>\r\n]*)<([^<>\s]+)>$/u

/** `user@example.com.au`: one `@`, a dot in the domain, no spaces or control characters. */
export function isEmailAddress(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ADDRESS) {
    return false
  }
  if (FORBIDDEN.test(value)) {
    return false
  }
  return PLAIN.test(value) && !value.includes("..")
}

/** An address, or `Display Name <address>`. */
export function isMailbox(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_MAILBOX) {
    return false
  }
  if (FORBIDDEN.test(value)) {
    return false
  }
  const trimmed = value.trim()
  if (isEmailAddress(trimmed)) {
    return true
  }
  const named = NAMED.exec(trimmed)
  return named !== null && isEmailAddress(named[2])
}

/**
 * `kamala@school.com.au` becomes `k***@school.com.au`: enough to tell two log lines
 * apart, not enough to read the address. Anything that is not an address
 * becomes `***`.
 */
export function maskEmail(value: unknown): string {
  if (typeof value !== "string") {
    return "***"
  }
  const at = value.lastIndexOf("@")
  if (at < 1 || at === value.length - 1) {
    return "***"
  }
  const head = Array.from(value.slice(0, at))[0] ?? ""
  const first = FORBIDDEN.test(head) ? "*" : head
  const domain = value.slice(at + 1).replace(FORBIDDEN, "")
  return `${first}***@${domain}`
}
