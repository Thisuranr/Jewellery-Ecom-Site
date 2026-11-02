import { orderConfirmedData, staffNewOrderData, type OrderRecord } from "../../../lib/email-data"
import { passwordResetLink } from "../../../lib/password-reset-link"
import { renderEmail } from "../lib/render"
import { formatAud } from "../templates/strings"

process.env.STORE_NAME = "Jewellery Store"

const ENV = { STOREFRONT_URL: "https://shop.example.com.au/au", MEDUSA_BACKEND_URL: "https://admin.example.com.au" }

// A sample order: a ring ($1,200.00) and earrings ($49.00 x 2), $15.00 shipping, $100.00 off.
// Prices include 10% GST: 1,313.00 total / 11 = 119.36 of GST.
const order: OrderRecord = {
  id: "order_01ABC",
  display_id: 42,
  email: "kamala@example.com",
  created_at: "2026-11-02T01:30:00.000Z",
  total: 1313,
  tax_total: 119.36,
  shipping_total: 15,
  // Medusa's discount_total already includes GST: here the whole 100.00 is taken off the items.
  original_item_total: 1298,
  item_total: 1198,
  discount_total: 100,
  item_discount_total: 100,
  shipping_discount_total: 0,
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
    { title: "Solitaire", product_title: "Diamond Solitaire Ring", variant_title: "18k / Size N", quantity: 1, total: 1200, original_total: 1200 },
    { title: "Studs", product_title: "Pearl Studs", variant_title: "Default variant", quantity: 2, total: 98, original_total: 98 },
  ],
}

describe("money", () => {
  it("formats AUD with thousands separators and two decimals", () => {
    expect(formatAud(49)).toBe("$49.00")
    expect(formatAud(1234.5)).toBe("$1,234.50")
    expect(formatAud(0)).toBe("$0.00")
    expect(formatAud(-10)).toBe("-$10.00")
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
    expect(mail.text).toContain("$1,200.00")
    expect(mail.text).toContain("Pearl Studs x 2:")
    expect(mail.text).not.toContain("Default variant")
    expect(mail.text).toContain("-$100.00")
    expect(mail.text).toContain("$15.00")
    expect(mail.text).toContain("$1,313.00")
    expect(mail.text).toContain("Includes GST of:")
    expect(mail.text).toContain("$119.36")
    expect(mail.text).toContain("12 Collins Street")
    expect(mail.text).toContain("https://shop.example.com.au/au/order/order_01ABC/confirmed")
    expect(mail.html).toContain('lang="en-AU"')
  })

  it("shows free shipping and no discount row when there is none", async () => {
    const mail = await renderEmail(
      "order-confirmed",
      orderConfirmedData(
        { ...order, shipping_total: 0, discount_total: 0, item_discount_total: 0, item_total: 1298, total: 1298 },
        ENV
      )
    )
    expect(mail.text).toContain("Free")
    expect(mail.text).not.toContain("Discount")
  })

  it("a $10-off code on a $49 item plus $10 shipping adds up", () => {
    // Medusa: discount_total (GST included) = 10, item_total after discount = 39, total = 39 + 10.
    const d = orderConfirmedData(
      {
        id: "order_p",
        total: 49,
        tax_total: 4.45,
        shipping_total: 10,
        original_item_total: 49,
        item_total: 39,
        discount_total: 10,
        item_discount_total: 10,
        shipping_discount_total: 0,
        items: [{ product_title: "Hoops", quantity: 1, total: 39, original_total: 49 }],
      },
      ENV
    )
    expect(d.subtotal_str).toBe("$49.00")
    expect(d.discount_str).toBe("-$10.00")
    expect(d.shipping_str).toBe("$10.00")
    expect(d.total_str).toBe("$49.00")
    expect(d.gst_included_str).toBe("$4.45")
    expect(d.items[0].total_str).toBe("$49.00")
  })

  it("a free-shipping code shows Free shipping and no discount row", () => {
    const d = orderConfirmedData(
      {
        id: "order_f",
        total: 49,
        tax_total: 4.45,
        shipping_total: 0,
        original_item_total: 49,
        item_total: 49,
        discount_total: 10, // the shipping discount, counted by Medusa
        item_discount_total: 0,
        shipping_discount_total: 10,
        items: [{ product_title: "Hoops", quantity: 1, total: 49, original_total: 49 }],
      },
      ENV
    )
    expect(d.subtotal_str).toBe("$49.00")
    expect(d.discount_str).toBeUndefined()
    expect(d.shipping_str).toBe("Free")
    expect(d.total_str).toBe("$49.00")
  })

  it("is a tax invoice with the seller name and ABN, and leaves the ABN out when unset", async () => {
    const before = process.env.STORE_ABN
    try {
      process.env.STORE_ABN = "12 345 678 901"
      let mail = await renderEmail("order-confirmed", orderConfirmedData(order, ENV))
      expect(mail.text).toContain("Tax invoice")
      expect(mail.text).toContain("Jewellery Store")
      expect(mail.text).toContain("ABN 12 345 678 901")
      delete process.env.STORE_ABN
      mail = await renderEmail("order-confirmed", orderConfirmedData(order, ENV))
      expect(mail.text).toContain("Tax invoice")
      expect(mail.text).not.toContain("ABN")
    } finally {
      if (before === undefined) delete process.env.STORE_ABN
      else process.env.STORE_ABN = before
    }
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
    expect(mail.subject).toBe("New order #42 ($1,313.00)")
    expect(mail.text).toContain("Kamala Perera (kamala@example.com)")
    expect(mail.text).toContain("https://admin.example.com.au/app/orders/order_01ABC")
  })

  it("renders the shipped email with a tracking link (https only)", async () => {
    const base = {
      order_display_id: "42",
      first_name: "Kamala",
      items: [{ title: "Ring", quantity: 1, total_str: "$10.00" }],
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
    expect(mail.text).toContain("refunded $49.00 for order #42")
  })
})

describe("custom enquiry emails", () => {
  it("shows every field to the store, keeping line breaks", async () => {
    const mail = await renderEmail("custom-enquiry-received", {
      name: "Sam",
      email: "sam@example.com",
      phone: "0400 000 000",
      budget: "$2,000",
      message: "A ring with my grandmother's stone.\nSecond line.",
    })
    expect(mail.subject).toBe("Custom order enquiry from Sam")
    for (const part of ["Sam", "sam@example.com", "0400 000 000", "$2,000", "grandmother's stone.", "Second line."]) {
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
    // Attacker-chosen text in the data must never reach the customer's inbox.
    const mail = await renderEmail("custom-enquiry-confirmation", {
      name: "EVIL-NAME",
      message: "EVIL-MESSAGE http://phish.example/x",
    })
    expect(mail.subject).toBe("We received your custom order request - Jewellery Store")
    expect(mail.text).toContain("Hi there,")
    expect(mail.text).toContain("2 business days")
    expect(mail.text).not.toContain("EVIL")
    expect(mail.text).not.toContain("phish")
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
