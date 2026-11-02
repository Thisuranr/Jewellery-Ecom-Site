import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Resend } from "resend"
import { errorCode } from "../../../lib/coded-error"
import { createConsoleTransport } from "../lib/transports"
import EmailNotificationProviderService from "../service"

// "console mode logs, writes the outbox (temp dir) and prints no
// link with NODE_ENV=production; resend mode calls a mocked resend with html and
// text; option errors; unknown template".

jest.mock("resend", () => ({ Resend: jest.fn() }))

process.env.STORE_NAME = "Jewellery Store"

const LF = String.fromCharCode(10)
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.RESET-TOKEN-PAYLOAD.sig_abc"
const RESET_URL = `https://shop.example.com.au/account/reset-password?token=${TOKEN}`

type Logged = { info: string[]; warn: string[]; error: string[] }

function fakeLogger() {
  const logged: Logged = { info: [], warn: [], error: [] }
  return {
    logged,
    logger: {
      info: (message: string) => logged.info.push(message),
      warn: (message: string) => logged.warn.push(message),
      error: (message: string) => logged.error.push(message),
    },
    all: () => [...logged.info, ...logged.warn, ...logged.error].join(LF),
  }
}

function notification(overrides: Record<string, unknown> = {}) {
  return {
    to: "kamala@school.com.au",
    channel: "email",
    template: "password-reset",
    data: { reset_url: RESET_URL, first_name: "Kamala", expires_minutes: 15 },
    ...overrides,
  } as Parameters<EmailNotificationProviderService["send"]>[0]
}

const savedNodeEnv = process.env.NODE_ENV
function setNodeEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = value
  }
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "email-outbox-"))
  ;(Resend as unknown as jest.Mock).mockReset()
})
afterEach(() => {
  setNodeEnv(savedNodeEnv)
  rmSync(dir, { recursive: true, force: true })
})

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
  } catch (error) {
    return errorCode((error as Error).message)
  }
  throw new Error("expected the promise to reject")
}

describe("the provider", () => {
  it("has the provider identifier", () => {
    expect(EmailNotificationProviderService.identifier).toBe("notification-email")
  })
})

describe("console transport", () => {
  it("renders the real template, logs a masked line and the text body, and returns an id", async () => {
    const { logger, logged, all } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })

    const result = await service.send(notification())

    expect(result.id).toMatch(/^console_[0-9a-f]{16}$/)
    expect(logged.info[0]).toBe(
      '[email:console] template=password-reset to=k***@school.com.au subject="Reset your Jewellery Store password"'
    )
    // Outside production the plain-text body is logged, so a developer can click the link.
    expect(logged.info[1]).toContain("text body of password-reset")
    expect(logged.info[1]).toContain(RESET_URL)
    expect(logged.info[1]).toContain("Hello Kamala,")
    expect(all()).not.toContain("kamala@school.com.au")
  })

  it("gives every send its own id", async () => {
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    const a = await service.send(notification())
    const b = await service.send(notification())
    expect(a.id).not.toBe(b.id)
  })

  it("writes the HTML to the outbox folder, creating it", async () => {
    const outbox = join(dir, "nested", "outbox")
    const { logger, logged } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console", outbox_dir: outbox })

    await service.send(notification())

    const files = readdirSync(outbox)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-password-reset\.html$/)
    const html = readFileSync(join(outbox, files[0]), "utf8")
    expect(html).toContain('lang="en-AU"')
    expect(html).toContain(RESET_URL)
    expect(html).toContain("Hello Kamala,")
    expect(logged.info.some((line) => line.includes("html copy:") && line.includes(files[0]))).toBe(true)
  })

  it("never overwrites a copy: two emails in the same millisecond get two files", async () => {
    const { logger } = fakeLogger()
    const fixed = new Date("2026-10-29T12:34:56.789Z")
    const transport = createConsoleTransport({ logger, outboxDir: dir, now: () => fixed })
    const email = { template: "password-reset", to: "a@b.com.au", subject: "s", html: "<p>1</p>", text: "1" }

    await transport.send(email)
    await transport.send({ ...email, html: "<p>2</p>" })

    expect(readdirSync(dir).sort()).toEqual([
      "2026-10-29T12-34-56-789Z-password-reset-1.html",
      "2026-10-29T12-34-56-789Z-password-reset.html",
    ])
    expect(readFileSync(join(dir, "2026-10-29T12-34-56-789Z-password-reset.html"), "utf8")).toBe("<p>1</p>")
    expect(readFileSync(join(dir, "2026-10-29T12-34-56-789Z-password-reset-1.html"), "utf8")).toBe("<p>2</p>")
  })

  it("prints no link, no body and writes no outbox when NODE_ENV is production", async () => {
    setNodeEnv("production")
    const outbox = join(dir, "outbox")
    const { logger, logged, all } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console", outbox_dir: outbox })

    const result = await service.send(notification())

    expect(result.id).toMatch(/^console_/)
    expect(logged.info).toHaveLength(1)
    expect(logged.info[0]).toContain("[email:console] template=password-reset to=k***@school.com.au")
    expect(all()).not.toContain(TOKEN)
    expect(all()).not.toContain("reset-password")
    expect(all()).not.toContain("https://")
    expect(all()).not.toContain("kamala@school.com.au")
    expect(existsSync(outbox)).toBe(false)
  })

  // R1 #3: Medusa and production-env.ts treat NODE_ENV=prod as production too, and any
  // value other than development or test may be a live server: never print a link there.
  it.each(["prod", "Production", "staging", ""])(
    "prints no link, no body and writes no outbox when NODE_ENV is %j",
    async (value) => {
      setNodeEnv(value)
      const outbox = join(dir, "outbox")
      const { logger, logged, all } = fakeLogger()
      const service = new EmailNotificationProviderService({ logger }, { transport: "console", outbox_dir: outbox })

      await service.send(notification())

      expect(logged.info).toHaveLength(1)
      expect(all()).not.toContain(TOKEN)
      expect(all()).not.toContain("reset-password")
      expect(existsSync(outbox)).toBe(false)
    }
  )

  it("prints no link when NODE_ENV is unset", async () => {
    setNodeEnv(undefined)
    const { logger, logged, all } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    await service.send(notification())
    expect(logged.info).toHaveLength(1)
    expect(all()).not.toContain(TOKEN)
  })

  it("reads NODE_ENV at every send", async () => {
    const { logger, logged } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    setNodeEnv("production")
    await service.send(notification())
    expect(logged.info).toHaveLength(1)
    setNodeEnv("development")
    await service.send(notification())
    expect(logged.info).toHaveLength(3)
  })

  it("logs a warning and still succeeds when the outbox cannot be written", async () => {
    const blocker = join(dir, "not-a-folder")
    writeFileSync(blocker, "x")
    const { logger, logged } = fakeLogger()
    const service = new EmailNotificationProviderService(
      { logger },
      { transport: "console", outbox_dir: join(blocker, "sub") }
    )

    const result = await service.send(notification())

    expect(result.id).toMatch(/^console_/)
    expect(logged.warn).toHaveLength(1)
    expect(logged.warn[0]).toContain("could not write the outbox copy")
  })

  it("renders before it logs: an unknown template logs nothing and writes nothing", async () => {
    const { logger, all } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console", outbox_dir: dir })
    expect(await codeOf(service.send(notification({ template: "order-placed" })))).toBe("unknown_template")
    expect(all()).toBe("")
    expect(readdirSync(dir)).toHaveLength(0)
  })

  it("falls back to the console when the container has no logger", async () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => undefined)
    try {
      const service = new EmailNotificationProviderService({}, { transport: "console" })
      await service.send(notification())
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe("resend transport", () => {
  const OPTIONS = {
    transport: "resend",
    api_key: "re_test_0123456789",
    from: "Teacher Store <noreply@mail.example.com.au>",
    reply_to: "help@example.com.au",
  }

  function mockResend(send: jest.Mock) {
    ;(Resend as unknown as jest.Mock).mockImplementation(() => ({ emails: { send } }))
  }

  it("calls Resend with the rendered html and text, the sender and the reply-to", async () => {
    const send = jest.fn().mockResolvedValue({ data: { id: "re_msg_1" }, error: null })
    mockResend(send)
    const { logger, all } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, OPTIONS)

    const result = await service.send(notification())

    expect(result).toEqual({ id: "re_msg_1" })
    expect(Resend).toHaveBeenCalledTimes(1)
    expect(Resend).toHaveBeenCalledWith("re_test_0123456789")
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0][0]
    expect(payload.from).toBe("Teacher Store <noreply@mail.example.com.au>")
    expect(payload.to).toBe("kamala@school.com.au")
    expect(payload.replyTo).toBe("help@example.com.au")
    expect(payload.subject).toBe("Reset your Jewellery Store password")
    expect(payload.html).toContain('<html dir="ltr" lang="en-AU">')
    expect(payload.html).toContain(RESET_URL)
    expect(payload.text).toContain(RESET_URL)
    expect(payload.text).toContain("Hello Kamala,")
    expect(Object.keys(payload).sort()).toEqual(["from", "html", "replyTo", "subject", "text", "to"])
    // The Resend transport does not log the email.
    expect(all()).toBe("")
  })

  it("sends no replyTo when none is configured", async () => {
    const send = jest.fn().mockResolvedValue({ data: { id: "re_msg_2" }, error: null })
    mockResend(send)
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService(
      { logger },
      { transport: "resend", api_key: "re_k", from: "noreply@mail.example.com.au" }
    )
    await service.send(notification())
    expect("replyTo" in send.mock.calls[0][0]).toBe(false)
  })

  it("always sends from the configured sender, whatever notification.from says", async () => {
    const send = jest.fn().mockResolvedValue({ data: { id: "re_msg_3" }, error: null })
    mockResend(send)
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, OPTIONS)
    await service.send(notification({ from: "ceo@evil.example" }))
    expect(send.mock.calls[0][0].from).toBe("Teacher Store <noreply@mail.example.com.au>")
  })

  it("throws email_send_failed when Resend answers with an error, without the address or the link", async () => {
    const send = jest.fn().mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        message: `Invalid to field kamala@school.com.au, see ${RESET_URL} for details`,
      },
    })
    mockResend(send)
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, OPTIONS)

    let message = ""
    try {
      await service.send(notification())
    } catch (error) {
      message = (error as Error).message
    }

    expect(errorCode(message)).toBe("email_send_failed")
    expect(message).toContain("validation_error")
    expect(message).toContain("status 422")
    expect(message).toContain("k***@school.com.au")
    expect(message).not.toContain("kamala@school.com.au")
    expect(message).not.toContain(TOKEN)
    expect(message).not.toContain("https://")
    expect(message).not.toContain("re_test_0123456789")
  })

  it("throws email_send_failed when the request itself fails, or Resend returns no id", async () => {
    const { logger } = fakeLogger()
    mockResend(jest.fn().mockRejectedValue(new Error("fetch failed for kamala@school.com.au")))
    const service = new EmailNotificationProviderService({ logger }, OPTIONS)
    let message = ""
    try {
      await service.send(notification())
    } catch (error) {
      message = (error as Error).message
    }
    expect(errorCode(message)).toBe("email_send_failed")
    expect(message).toContain("fetch failed")
    expect(message).not.toContain("kamala@school.com.au")

    mockResend(jest.fn().mockResolvedValue({ data: null, error: null }))
    const second = new EmailNotificationProviderService({ logger }, OPTIONS)
    expect(await codeOf(second.send(notification()))).toBe("email_send_failed")
  })

  it("does not call Resend for an unknown template or a bad recipient", async () => {
    const send = jest.fn()
    mockResend(send)
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, OPTIONS)
    expect(await codeOf(service.send(notification({ template: "nope" })))).toBe("unknown_template")
    expect(await codeOf(service.send(notification({ to: "nobody" })))).toBe("invalid_recipient")
    expect(send).not.toHaveBeenCalled()
  })
})

describe("what the provider refuses", () => {
  it("refuses a recipient that is not one plain address", async () => {
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    for (const to of ["", "nobody", `a@b.com.au${LF}Bcc: x@y.com.au`, "a@b.com.au, c@d.com.au", "Name <a@b.com.au>", undefined, 5]) {
      expect(await codeOf(service.send(notification({ to })))).toBe("invalid_recipient")
    }
  })

  it("trims the recipient", async () => {
    const { logger, logged } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    await service.send(notification({ to: "  kamala@school.com.au  " }))
    expect(logged.info[0]).toContain("to=k***@school.com.au")
  })

  it("serves the email channel only", async () => {
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    expect(await codeOf(service.send(notification({ channel: "sms" })))).toBe("unsupported_channel")
    expect(await codeOf(service.send(notification({ channel: "feed" })))).toBe("unsupported_channel")
  })

  it("refuses bad template data before sending", async () => {
    const { logger, all } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    expect(await codeOf(service.send(notification({ data: { } })))).toBe("invalid_template_data")
    expect(await codeOf(service.send(notification({ data: null })))).toBe("invalid_template_data")
    expect(all()).toBe("")
  })

  it("refuses an empty notification", async () => {
    const { logger } = fakeLogger()
    const service = new EmailNotificationProviderService({ logger }, { transport: "console" })
    await expect(service.send(undefined as never)).rejects.toThrow("No notification information provided")
  })
})

describe("option errors", () => {
  it("refuses to build with the Resend transport and no key", () => {
    const { logger } = fakeLogger()
    expect(() => new EmailNotificationProviderService({ logger }, { transport: "resend", from: "a@b.com.au" })).toThrow(
      /api_key \(RESEND_API_KEY/
    )
  })

  it("refuses an unknown transport", () => {
    const { logger } = fakeLogger()
    expect(() => new EmailNotificationProviderService({ logger }, { transport: "smtp" })).toThrow(
      /transport \(EMAIL_TRANSPORT/
    )
  })

  it("refuses to start (validateOptions) with the Resend transport and no key, naming the variable", () => {
    expect(() =>
      EmailNotificationProviderService.validateOptions({ channels: ["email"], transport: "resend", from: "a@b.com.au" })
    ).toThrow(/Email provider is missing or has invalid options: api_key \(RESEND_API_KEY/)
    expect(() => EmailNotificationProviderService.validateOptions({ transport: "resend", api_key: "re_x" })).toThrow(
      /from \(EMAIL_FROM/
    )
  })
})
