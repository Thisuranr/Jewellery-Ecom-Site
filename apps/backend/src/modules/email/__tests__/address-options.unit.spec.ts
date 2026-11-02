import { isEmailAddress, isMailbox, maskEmail } from "../lib/address"
import { parseEmailOptions } from "../lib/options"

// Plan M3 E1: option errors, and the address helpers the provider uses to keep
// header-breaking input out and addresses out of logs.

const LF = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const LS = String.fromCharCode(0x2028)

describe("isEmailAddress", () => {
  it.each(["a@b.com.au", "kamala.perera@school.edu.com.au", "x+tag@example.com", "u_1@mail.example.com.au"])(
    "accepts %s",
    (value) => {
      expect(isEmailAddress(value)).toBe(true)
    }
  )

  it.each([
    "",
    "plain",
    "a@b",
    "@b.com.au",
    "a@.au",
    "a b@c.com.au",
    "a@@b.com.au",
    "a@b..com.au",
    `a@b.com.au${LF}Bcc: x@y.com.au`,
    `a@b.com.au${CR}`,
    `a@b${LS}.com.au`,
    "<a@b.com.au>",
    "Name <a@b.com.au>",
    "a@b.com.au, c@d.com.au",
  ])("refuses %j", (value) => {
    expect(isEmailAddress(value)).toBe(false)
  })

  it("refuses non-strings and addresses over 254 characters", () => {
    expect(isEmailAddress(undefined)).toBe(false)
    expect(isEmailAddress(null)).toBe(false)
    expect(isEmailAddress(42)).toBe(false)
    expect(isEmailAddress(`${"a".repeat(250)}@b.com.au`)).toBe(false)
  })
})

describe("isMailbox", () => {
  it("accepts an address or a display name with an address", () => {
    expect(isMailbox("noreply@example.com.au")).toBe(true)
    expect(isMailbox("Teacher Store <noreply@example.com.au>")).toBe(true)
    expect(isMailbox("  Teacher Store <noreply@example.com.au>  ")).toBe(true)
  })

  it("refuses a broken address and header injection", () => {
    expect(isMailbox("Teacher Store <noreply>")).toBe(false)
    expect(isMailbox("Teacher Store noreply@example.com.au>")).toBe(false)
    expect(isMailbox(`Teacher Store <a@b.com.au>${LF}Bcc: x@y.com.au`)).toBe(false)
    expect(isMailbox("")).toBe(false)
    expect(isMailbox(7)).toBe(false)
  })
})

describe("maskEmail", () => {
  it("keeps the first letter and the domain only", () => {
    expect(maskEmail("kamala@school.com.au")).toBe("k***@school.com.au")
    expect(maskEmail("a@b.com.au")).toBe("a***@b.com.au")
  })

  it("keeps the first code point of a non-Latin name whole", () => {
    expect(maskEmail("\u{1F600}x@b.com.au")).toBe("\u{1F600}***@b.com.au")
  })

  it("hides anything that is not an address", () => {
    expect(maskEmail("")).toBe("***")
    expect(maskEmail("no-at-sign")).toBe("***")
    expect(maskEmail("@b.com.au")).toBe("***")
    expect(maskEmail("a@")).toBe("***")
    expect(maskEmail(undefined)).toBe("***")
    expect(maskEmail(12)).toBe("***")
  })

  it("never lets a line break through into a log line", () => {
    const masked = maskEmail(`${LF}a@b${LF}.com.au`)
    expect(masked).not.toContain(LF)
    expect(maskEmail(`${CR}x@b.com.au`)).toBe("*" + "***@b.com.au")
  })
})

function messageOf(options: Record<string, unknown> | undefined): string {
  try {
    parseEmailOptions(options)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error("expected parseEmailOptions to throw")
}

describe("parseEmailOptions", () => {
  it("accepts the console transport with nothing else", () => {
    expect(parseEmailOptions({ transport: "console" })).toEqual({
      channels: undefined,
      transport: "console",
      from: undefined,
      reply_to: undefined,
      api_key: undefined,
      outbox_dir: undefined,
    })
  })

  it("accepts the Resend transport with a key and a sender", () => {
    const parsed = parseEmailOptions({
      channels: ["email"],
      transport: "resend",
      api_key: "re_test_key",
      from: "Teacher Store <noreply@mail.example.com.au>",
      reply_to: "help@example.com.au",
    })
    expect(parsed.transport).toBe("resend")
    expect(parsed.api_key).toBe("re_test_key")
    expect(parsed.reply_to).toBe("help@example.com.au")
    expect(parsed.channels).toEqual(["email"])
  })

  it("trims values and counts an empty string as not set", () => {
    const parsed = parseEmailOptions({
      transport: "console",
      from: "  ",
      reply_to: "",
      api_key: "",
      outbox_dir: " ",
    })
    expect(parsed).toMatchObject({ from: undefined, reply_to: undefined, api_key: undefined, outbox_dir: undefined })
    expect(parseEmailOptions({ transport: "resend", api_key: "  re_x  ", from: " a@b.com.au " })).toMatchObject({
      api_key: "re_x",
      from: "a@b.com.au",
    })
  })

  it("refuses a transport that is neither console nor resend", () => {
    expect(messageOf({ transport: "smtp" })).toContain("transport (EMAIL_TRANSPORT")
    expect(messageOf({})).toContain("transport (EMAIL_TRANSPORT")
    expect(messageOf(undefined)).toContain("transport (EMAIL_TRANSPORT")
    expect(messageOf({ transport: "Console" })).toContain("transport (EMAIL_TRANSPORT")
  })

  it("makes Resend refuse to start without a key, naming the variable", () => {
    const message = messageOf({ transport: "resend", from: "a@b.com.au" })
    expect(message).toContain("api_key (RESEND_API_KEY")
    expect(message).not.toContain("from (EMAIL_FROM")
    expect(messageOf({ transport: "resend", from: "a@b.com.au", api_key: "   " })).toContain("RESEND_API_KEY")
  })

  it("makes Resend need a sender", () => {
    const message = messageOf({ transport: "resend", api_key: "re_x" })
    expect(message).toContain("from (EMAIL_FROM")
    expect(message).not.toContain("RESEND_API_KEY")
  })

  it("lists every wrong option at once", () => {
    const message = messageOf({ transport: "resend", from: "not an address", reply_to: "also bad" })
    expect(message).toContain("RESEND_API_KEY")
    expect(message).toContain("EMAIL_FROM")
    expect(message).toContain("EMAIL_REPLY_TO")
  })

  it("checks the sender and reply-to even for the console transport", () => {
    expect(messageOf({ transport: "console", from: "bad" })).toContain("EMAIL_FROM")
    expect(messageOf({ transport: "console", reply_to: "bad" })).toContain("EMAIL_REPLY_TO")
  })

  it("refuses header injection in the sender", () => {
    expect(messageOf({ transport: "console", from: `a@b.com.au${LF}Bcc: x@y.com.au` })).toContain("EMAIL_FROM")
  })

  it("never puts an option value in the message", () => {
    const secret = "re_SECRET_KEY_VALUE_123"
    const message = messageOf({ transport: "smtp", api_key: secret, from: "bad-address-value", outbox_dir: 5 })
    expect(message).not.toContain(secret)
    expect(message).not.toContain("bad-address-value")
    expect(message).not.toContain("smtp")
  })

  it("refuses an api_key or outbox_dir that is not a string", () => {
    expect(messageOf({ transport: "console", api_key: 5 })).toContain("RESEND_API_KEY")
    expect(messageOf({ transport: "console", outbox_dir: 5 })).toContain("EMAIL_OUTBOX_DIR")
  })
})
