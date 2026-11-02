import { orderConfirmedData, staffNewOrderData, type OrderRecord } from "../../../lib/email-data"
import { passwordResetLink } from "../../../lib/password-reset-link"
import { renderEmail } from "../lib/render"
import { formatAud } from "../templates/strings"

process.env.STORE_NAME = "Jewellery Store"

const ENV = { STOREFRONT_URL: "https://shop.example.com.au/au", MEDUSA_BACKEND_URL: "https://admin.example.com.au" }

// A sample order: a ring (A$1,200.00) and earrings (A$49.00 x 2), A$15.00 shipping, A$100.00 off.
// Prices include 10% GST: 1,313.00 total / 11 = 119.36 of GST.
const order: OrderRecord = {
  id: "order_01ABC",
  display_id: 42,
  email: "kamala@example.com",
  created_at: "2026-11-02T01:30:00.000Z",
  total: 1313,
  tax_total: 119.36,
  shipping_total: 15,
  discount_total: 90.91,
  discount_tax_total: 9.09,
  customer: { first_name: "Kamala", last_name: "Perera" },
  shipping_address: {
    first_name: "Kamala",
    last_name: "Perera",
    address_1: "12 Collins Street",
    city: "Melbourne",
    province: "VIC",
    postal_code: "3000",
    country_code: "au",
  },
  items: [
    { title: "Solitaire", product_title: "Diamond Solitaire Ring", variant_title: "18k / Size N", quantity: 1, total: 1200 },
    { title: "Studs", product_title: "Pearl Studs", variant_title: "Default variant", quantity: 2, total: 98 },
  ],
}

describe("money", () => {
  it("formats AUD with thousands separators and two decimals", () => {
    expect(formatAud(49)).toBe("A$49.00")
    expect(formatAud(1234.5)).toBe("A$1,234.50")
    expect(formatAud(0)).toBe("A$0.00")
    expect(formatAud(-10)).toBe("-A$10.00")
  })
})

describe("order confirmation", () => {
  it("renders the sample AUD order with GST and the order link", async () => {
    const mail = await renderEmail("order-confirmed", orderConfirmedData(order, ENV))
    // eslint-disable-next-line no-console
    console.log(`SUBJECT: ${mail.subject}\n\n${mail.text}`)
    expect(mail.subject).toBe("Your Jewellery Store order #42 is confirmed")
    expect(mail.text).toContain("Hello Kamala,")
    expect(mail.text).toContain("#42")
    expect(mail.text).toContain("2 November 2026")
    expect(mail.text).toContain("Diamond Solitaire Ring (18k / Size N) x 1:")
    expect(mail.text).toContain("A$1,200.00")
    expect(mail.text).toContain("Pearl Studs x 2:")
    expect(mail.text).not.toContain("Default variant")
    expect(mail.text).toContain("-A$100.00")
    expect(mail.text).toContain("A$15.00")
    expect(mail.text).toContain("A$1,313.00")
    expect(mail.text).toContain("Includes GST of:")
    expect(mail.text).toContain("A$119.36")
    expect(mail.text).toContain("12 Collins Street")
    expect(mail.text).toContain("https://shop.example.com.au/au/order/order_01ABC/confirmed")
    expect(mail.html).toContain('lang="en-AU"')
  })

  it("shows free shipping and no discount row when there is none", async () => {
    const mail = await renderEmail(
      "order-confirmed",
      orderConfirmedData({ ...order, shipping_total: 0, discount_total: 0, discount_tax_total: 0, total: 1298 }, ENV)
    )
    expect(mail.text).toContain("Free")
    expect(mail.text).not.toContain("Discount")
  })

  it("HTML-escapes product titles and names", async () => {
    const mail = await renderEmail(
      "order-confirmed",
      orderConfirmedData({ ...order, items: [{ product_title: "<b>Ring</b>", quantity: 1, total: 10 }] }, ENV)
    )
    expect(mail.html).not.toContain("<b>Ring</b>")
  })

  it("refuses an order with no items", async () => {
    await expect(renderEmail("order-confirmed", { ...orderConfirmedData(order, ENV), items: [] })).rejects.toThrow(
      /invalid_template_data/
    )
  })
})

describe("the other order emails", () => {
  it("renders the new-order alert for the owner with an admin link", async () => {
    const mail = await renderEmail("staff-new-order", staffNewOrderData(order, ENV))
    expect(mail.subject).toBe("New order #42 (A$1,313.00)")
    expect(mail.text).toContain("Kamala Perera (kamala@example.com)")
    expect(mail.text).toContain("https://admin.example.com.au/app/orders/order_01ABC")
  })

  it("renders the shipped email with a tracking link (https only)", async () => {
    const base = {
      order_display_id: "42",
      first_name: "Kamala",
      items: [{ title: "Ring", quantity: 1, total_str: "A$10.00" }],
      address_lines: ["12 Collins Street"],
      order_url: "https://shop.example.com.au/au/account/orders/details/order_01ABC",
    }
    const mail = await renderEmail("order-shipped", {
      ...base,
      tracking: [{ number: "AP123", url: "https://auspost.com.au/track/AP123", carrier: "Australia Post" }],
    })
    expect(mail.subject).toBe("Your Jewellery Store order #42 has shipped")
    expect(mail.text).toContain("AP123")
    expect(mail.text).toContain("https://auspost.com.au/track/AP123")
    await expect(
      renderEmail("order-shipped", { ...base, tracking: [{ number: "X", url: "http://insecure.example.com" }] })
    ).rejects.toThrow(/invalid_template_data/)
  })

  it("renders the refund email in AUD", async () => {
    const mail = await renderEmail("refund-issued", {
      order_display_id: "42",
      first_name: "Kamala",
      refund_str: formatAud(49),
      order_url: "https://shop.example.com.au/au/account/orders/details/order_01ABC",
    })
    expect(mail.subject).toBe("Your Jewellery Store refund for order #42")
    expect(mail.text).toContain("refunded A$49.00 for order #42")
  })
})

describe("custom enquiry emails", () => {
  it("shows every field to the store, keeping line breaks", async () => {
    const mail = await renderEmail("custom-enquiry-received", {
      name: "Sam",
      email: "sam@example.com",
      phone: "0400 000 000",
      budget: "A$2,000",
      message: "A ring with my grandmother's stone.\nSecond line.",
    })
    expect(mail.subject).toBe("Custom order enquiry from Sam")
    for (const part of ["Sam", "sam@example.com", "0400 000 000", "A$2,000", "grandmother's stone.", "Second line."]) {
      expect(mail.text).toContain(part)
    }
    expect(mail.html).toContain("<br")
  })

  it("keeps a line break out of the subject", async () => {
    const mail = await renderEmail("custom-enquiry-received", {
      name: "Sam\r\nBcc: x@y.com",
      email: "sam@example.com",
      message: "A long enough message.",
    })
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })

  it("confirms to the customer", async () => {
    const mail = await renderEmail("custom-enquiry-confirmation", { name: "Sam", message: "A long enough message." })
    expect(mail.subject).toBe("We received your custom order request - Jewellery Store")
    expect(mail.text).toContain("Hello Sam,")
  })
})

describe("password reset links", () => {
  it("points a customer at the storefront reset page", () => {
    expect(passwordResetLink({ entity_id: "a@b.com", actor_type: "customer", token: "t+k/n" }, ENV)).toEqual({
      email: "a@b.com",
      url: "https://shop.example.com.au/au/account/reset-password?token=t%2Bk%2Fn&email=a%40b.com",
    })
  })
  it("points an admin user at the admin app", () => {
    expect(passwordResetLink({ entity_id: "a@b.com", actor_type: "user", token: "tok" }, ENV)?.url).toBe(
      "https://admin.example.com.au/app/reset-password?token=tok&email=a%40b.com"
    )
  })
  it("skips incomplete or unknown events", () => {
    expect(passwordResetLink({ entity_id: "a@b.com", actor_type: "customer" }, ENV)).toBeNull()
    expect(passwordResetLink({ entity_id: "nope", actor_type: "customer", token: "t" }, ENV)).toBeNull()
    expect(passwordResetLink({ entity_id: "a@b.com", actor_type: "other", token: "t" }, ENV)).toBeNull()
  })
})
