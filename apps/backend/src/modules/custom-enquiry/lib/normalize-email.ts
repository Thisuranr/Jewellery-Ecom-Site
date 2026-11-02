const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"])

/**
 * One key per real inbox, for throttling: trimmed, lower case, "+tag" removed from the local part,
 * and dots removed for Gmail (a.b@gmail.com and ab+x@googlemail.com are the same inbox).
 */
export function normalizeEmail(email: string): string {
  const value = email.trim().toLowerCase()
  const at = value.lastIndexOf("@")
  if (at < 1) {
    return value
  }
  let local = value.slice(0, at)
  let domain = value.slice(at + 1)
  const plus = local.indexOf("+")
  if (plus > 0) {
    local = local.slice(0, plus)
  }
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./gu, "")
    domain = "gmail.com"
  }
  return `${local}@${domain}`
}
