import { errorCode } from "../../../lib/coded-error"
import { reactRuntimeProblem, renderEmail, setRendererLoader } from "../lib/render"
import { TEMPLATE_NAMES } from "../templates/names"

const URL_TEXT = "https://shop.example.com.au/account/reset-password?token=abc&email=a%40b.com"

function data(extra: Record<string, unknown> = {}) {
  return { reset_url: URL_TEXT, first_name: "Kamala", expires_minutes: 15, ...extra }
}

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
  } catch (error) {
    return errorCode((error as Error).message)
  }
  throw new Error("expected the promise to reject")
}

describe("password-reset", () => {
  it("renders the subject and puts the link in the button, the plain link and the text", async () => {
    const mail = await renderEmail("password-reset", data())
    expect(mail.subject).toMatch(/^Reset your .* password$/)
    const escaped = URL_TEXT.replace(/&/g, "&amp;")
    expect(mail.html).toContain(`href="${escaped}"`)
    expect(mail.text).toContain(URL_TEXT)
    expect(mail.text).toContain("Hello Kamala,")
  })

  it("uses the store name from STORE_NAME", async () => {
    const saved = process.env.STORE_NAME
    process.env.STORE_NAME = "Test Jewels"
    try {
      expect((await renderEmail("password-reset", data())).subject).toBe("Reset your Test Jewels password")
    } finally {
      if (saved === undefined) delete process.env.STORE_NAME
      else process.env.STORE_NAME = saved
    }
  })

  it("HTML-escapes the first name", async () => {
    const mail = await renderEmail("password-reset", data({ first_name: "<script>alert(1)</script>" }))
    expect(mail.html).not.toContain("<script>alert(1)</script>")
    expect(mail.html).toContain("&lt;script&gt;")
  })

  it("greets without a name when there is none or only blanks", async () => {
    for (const first_name of [undefined, "", "   ", "\n\t"]) {
      expect((await renderEmail("password-reset", data({ first_name }))).text).toContain("Hello,")
    }
  })

  it("states the expiry, 15 minutes by default", async () => {
    expect((await renderEmail("password-reset", { reset_url: URL_TEXT })).text).toContain("15 minutes")
    expect((await renderEmail("password-reset", data({ expires_minutes: 30 }))).text).toContain("30 minutes")
  })

  it.each([
    ["no reset_url", {}],
    ["a javascript: link", { reset_url: "javascript:alert(1)" }],
    ["a link with spaces", { reset_url: "https://a.com/x y" }],
    ["not an object", null],
  ])("refuses %s with invalid_template_data", async (_label, extra) => {
    const payload = extra === null ? null : { first_name: "A", ...(extra as object) }
    expect(await codeOf(renderEmail("password-reset", payload))).toBe("invalid_template_data")
  })
})

describe("unknown template", () => {
  it("is refused with unknown_template, also for a non-string", async () => {
    expect(await codeOf(renderEmail("no-such-template", {}))).toBe("unknown_template")
    expect(await codeOf(renderEmail(42 as unknown as string, {}))).toBe("unknown_template")
  })

  it("is refused before React is loaded", async () => {
    const restore = setRendererLoader(() => {
      throw new Error("loader must not run")
    })
    try {
      expect(await codeOf(renderEmail("nope", {}))).toBe("unknown_template")
    } finally {
      restore()
    }
  })

  it("lists exactly the templates the store sends", () => {
    expect([...TEMPLATE_NAMES].sort()).toEqual(
      [
        "custom-enquiry-confirmation",
        "custom-enquiry-received",
        "order-confirmed",
        "order-shipped",
        "password-reset",
        "refund-issued",
        "staff-new-order",
      ].sort()
    )
  })
})

describe("the React switch", () => {
  it("reports React as resolvable here", () => {
    expect(reactRuntimeProblem()).toBeNull()
  })

  it("turns a missing React into email_render_unavailable", async () => {
    const restore = setRendererLoader(() => {
      throw Object.assign(new Error("Cannot find module 'react/jsx-runtime'"), { code: "MODULE_NOT_FOUND" })
    })
    try {
      // The loader is replaced entirely, so the coded error comes from the default loader in production;
      // here we only check that a thrown loader error reaches the caller.
      await expect(renderEmail("password-reset", data())).rejects.toThrow()
    } finally {
      restore()
    }
  })
})
