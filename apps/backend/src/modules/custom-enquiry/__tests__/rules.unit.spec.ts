import { customOrderEmail } from "../../../lib/custom-order-email"
import {
  AdminListEnquiriesSchema,
  AdminUpdateEnquirySchema,
  hourlyCap,
  isHoneypotTripped,
  isOverCap,
  isThrottled,
  MAX_ENQUIRIES_PER_EMAIL,
  StoreCreateEnquirySchema,
  THROTTLE_WINDOW_MS,
  throttleWindowStart,
} from "../lib/rules"
import { normalizeEmail } from "../lib/normalize-email"

const valid = { name: "Sam", email: "sam@example.com", message: "I would like a custom ring." }

describe("StoreCreateEnquirySchema", () => {
  it("accepts the minimum and trims every text", () => {
    const r = StoreCreateEnquirySchema.parse({ name: "  Sam  ", email: "  sam@example.com ", message: "  ten chars ok  " })
    expect(r).toMatchObject({ name: "Sam", email: "sam@example.com", message: "ten chars ok" })
    expect(r.phone).toBeUndefined()
    expect(r.budget).toBeUndefined()
  })

  it("turns blank or null optional fields into undefined and trims the others", () => {
    const r = StoreCreateEnquirySchema.parse({ ...valid, phone: "   ", budget: null })
    expect(r.phone).toBeUndefined()
    expect(r.budget).toBeUndefined()
    expect(StoreCreateEnquirySchema.parse({ ...valid, phone: " 0400 ", budget: " A$500 " })).toMatchObject({
      phone: "0400",
      budget: "A$500",
    })
  })

  it.each([
    ["empty name", { name: "   " }],
    ["name over 100", { name: "a".repeat(101) }],
    ["bad email", { email: "not-an-email" }],
    ["email with spaces inside", { email: "a b@example.com" }],
    ["phone over 30", { phone: "1".repeat(31) }],
    ["message under 10 (after trim)", { message: "  short   " }],
    ["message over 2000", { message: "a".repeat(2001) }],
    ["budget over 100", { budget: "a".repeat(101) }],
    ["no message", { message: undefined }],
  ])("rejects %s", (_label, change) => {
    expect(StoreCreateEnquirySchema.safeParse({ ...valid, ...change }).success).toBe(false)
  })

  it("accepts the boundary lengths", () => {
    const r = StoreCreateEnquirySchema.safeParse({
      name: "a".repeat(100),
      email: "sam@example.com",
      phone: "1".repeat(30),
      message: "a".repeat(2000),
      budget: "b".repeat(100),
    })
    expect(r.success).toBe(true)
  })

  it("ignores unknown fields instead of storing them", () => {
    const r = StoreCreateEnquirySchema.parse({ ...valid, status: "closed", id: "x" })
    expect(r).not.toHaveProperty("status")
    expect(r).not.toHaveProperty("id")
  })
})

describe("honeypot", () => {
  it("trips on any non-blank value only", () => {
    expect(isHoneypotTripped({ website: "http://spam.example" })).toBe(true)
    expect(isHoneypotTripped({ website: " x " })).toBe(true)
    expect(isHoneypotTripped({ website: "" })).toBe(false)
    expect(isHoneypotTripped({ website: "   " })).toBe(false)
    expect(isHoneypotTripped({})).toBe(false)
  })
})

describe("throttle rule", () => {
  it("allows three enquiries per hour and refuses the fourth", () => {
    expect(MAX_ENQUIRIES_PER_EMAIL).toBe(3)
    expect([0, 1, 2].map(isThrottled)).toEqual([false, false, false])
    expect([3, 4, 100].map(isThrottled)).toEqual([true, true, true])
  })

  it("looks back exactly one hour", () => {
    const now = new Date("2026-11-02T10:00:00.000Z")
    expect(THROTTLE_WINDOW_MS).toBe(3_600_000)
    expect(throttleWindowStart(now).toISOString()).toBe("2026-11-02T09:00:00.000Z")
  })
})

describe("admin schemas", () => {
  it("defaults and bounds the list query", () => {
    expect(AdminListEnquiriesSchema.parse({})).toEqual({ limit: 20, offset: 0 })
    expect(AdminListEnquiriesSchema.parse({ limit: "50", offset: "10", status: "new" })).toEqual({
      limit: 50,
      offset: 10,
      status: "new",
    })
    expect(AdminListEnquiriesSchema.safeParse({ limit: "0" }).success).toBe(false)
    expect(AdminListEnquiriesSchema.safeParse({ limit: "101" }).success).toBe(false)
    expect(AdminListEnquiriesSchema.safeParse({ status: "spam" }).success).toBe(false)
  })

  it("accepts only a known status, and nothing else, on update", () => {
    expect(AdminUpdateEnquirySchema.safeParse({ status: "contacted" }).success).toBe(true)
    expect(AdminUpdateEnquirySchema.safeParse({ status: "archived" }).success).toBe(false)
    expect(AdminUpdateEnquirySchema.safeParse({ status: "closed", email: "x@y.com" }).success).toBe(false)
    expect(AdminUpdateEnquirySchema.safeParse({}).success).toBe(false)
  })
})

describe("customOrderEmail", () => {
  it("uses the placeholder until CUSTOM_ORDER_EMAIL is set", () => {
    expect(customOrderEmail({})).toBe("orders@example.com")
    expect(customOrderEmail({ CUSTOM_ORDER_EMAIL: " " })).toBe("orders@example.com")
    expect(customOrderEmail({ CUSTOM_ORDER_EMAIL: "shop@real.com.au" })).toBe("shop@real.com.au")
  })
})

describe("control characters", () => {
  it.each([
    ["name", { name: "Sam\u0000" }],
    ["message", { message: "a long message\u0000here" }],
    ["phone", { phone: "04\u000100" }],
    ["budget", { budget: "A$5\u007f" }],
    ["email", { email: "a\u0000@example.com" }],
  ])("rejects a control character in %s", (_f, patch) => {
    expect(StoreCreateEnquirySchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })

  it("keeps line breaks and tabs in the message", () => {
    const r = StoreCreateEnquirySchema.parse({ ...valid, message: "line one\r\nline\ttwo" })
    expect(r.message).toBe("line one\r\nline\ttwo")
  })
})

describe("normalizeEmail", () => {
  it.each([
    ["  Sam@Example.COM ", "sam@example.com"],
    ["sam+a@example.com", "sam@example.com"],
    ["sam+b+c@example.com", "sam@example.com"],
    ["s.am@example.com", "s.am@example.com"],
    ["s.a.m+x@gmail.com", "sam@gmail.com"],
    ["Sa.M@googlemail.com", "sam@gmail.com"],
  ])("%s -> %s", (input, out) => {
    expect(normalizeEmail(input)).toBe(out)
  })
})

describe("hourly cap", () => {
  it("defaults to 30 and reads a positive whole number from the env", () => {
    expect(hourlyCap(undefined)).toBe(30)
    expect(hourlyCap("5")).toBe(5)
    expect(hourlyCap("0")).toBe(30)
    expect(hourlyCap("abc")).toBe(30)
    expect(hourlyCap("")).toBe(30)
  })
  it("refuses at the cap", () => {
    expect(isOverCap(29, 30)).toBe(false)
    expect(isOverCap(30, 30)).toBe(true)
  })
})
