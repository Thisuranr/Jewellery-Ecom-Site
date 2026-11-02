import { formatAud, storefrontUrl } from "../modules/email/templates/strings"

/**
 * Turns Medusa records into the ready-made strings the email templates take.
 * Pure (no container), so a test can feed it a sample order. Medusa stores
 * amounts in major units (dollars) and, with tax-inclusive pricing, every total
 * already includes the 10% GST; `tax_total` is the GST part.
 */

export type OrderRecord = {
  id: string
  display_id?: number | string | null
  email?: string | null
  created_at?: string | Date | null
  total?: number | string | null
  tax_total?: number | string | null
  shipping_total?: number | string | null
  discount_total?: number | string | null
  discount_tax_total?: number | string | null
  customer?: { first_name?: string | null; last_name?: string | null } | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
    country_code?: string | null
  } | null
  items?: Array<{
    title?: string | null
    product_title?: string | null
    variant_title?: string | null
    quantity?: number | string | null
    total?: number | string | null
  }> | null
}

/** Medusa returns amounts as numbers or BigNumber-like values; read them as numbers. */
export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value as string)
  return Number.isFinite(n) ? n : 0
}

export function emailItems(order: OrderRecord) {
  return (order.items ?? []).map((item) => ({
    title: (item.product_title || item.title || "Item").trim() || "Item",
    // "Default variant" is Medusa's placeholder for a product without options.
    variant_title: item.variant_title && item.variant_title !== "Default variant" ? item.variant_title : undefined,
    quantity: Math.max(0, Math.trunc(num(item.quantity))),
    total_str: formatAud(num(item.total)),
  }))
}

export function addressLines(order: OrderRecord): string[] {
  const a = order.shipping_address
  if (!a) {
    return []
  }
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ")
  const place = [a.city, a.province, a.postal_code].filter(Boolean).join(" ")
  const country = a.country_code ? a.country_code.toUpperCase() : ""
  return [name, a.address_1, a.address_2, place, country].map((l) => (l ?? "").trim()).filter(Boolean)
}

export function firstName(order: OrderRecord): string | undefined {
  return order.shipping_address?.first_name?.trim() || order.customer?.first_name?.trim() || undefined
}

export function fullName(order: OrderRecord): string | undefined {
  const a = order.shipping_address
  const name = [a?.first_name ?? order.customer?.first_name, a?.last_name ?? order.customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
  return name || undefined
}

export function orderDate(order: OrderRecord): string {
  const d = order.created_at ? new Date(order.created_at) : new Date()
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" }).format(d)
}

export function orderUrl(order: OrderRecord, env: NodeJS.ProcessEnv = process.env): string {
  return `${storefrontUrl(env)}/order/${order.id}/confirmed`
}

/** Later emails link to the account page (the customer signs in to see it). */
export function orderAccountUrl(order: { id: string }, env: NodeJS.ProcessEnv = process.env): string {
  return `${storefrontUrl(env)}/account/orders/details/${order.id}`
}

/** The data for the "order-confirmed" template. */
export function orderConfirmedData(order: OrderRecord, env: NodeJS.ProcessEnv = process.env) {
  const total = num(order.total)
  const shipping = num(order.shipping_total)
  const discount = num(order.discount_total) + num(order.discount_tax_total)
  return {
    order_display_id: String(order.display_id ?? order.id),
    order_date: orderDate(order),
    first_name: firstName(order),
    items: emailItems(order),
    // Before any discount, GST included: what the items cost in total.
    subtotal_str: formatAud(total - shipping + discount),
    discount_str: discount > 0 ? `-${formatAud(discount)}` : undefined,
    shipping_str: shipping > 0 ? formatAud(shipping) : "Free",
    total_str: formatAud(total),
    gst_included_str: formatAud(num(order.tax_total)),
    address_lines: addressLines(order),
    order_url: orderUrl(order, env),
  }
}

/** The data for the "staff-new-order" alert. */
export function staffNewOrderData(order: OrderRecord, env: NodeJS.ProcessEnv = process.env) {
  const backend = env.MEDUSA_BACKEND_URL?.trim()
  const base = backend && /^https?:\/\//u.test(backend) ? backend.replace(/\/+$/u, "") : "http://localhost:9000"
  return {
    order_display_id: String(order.display_id ?? order.id),
    customer_name: fullName(order),
    customer_email: order.email ?? "unknown",
    items: emailItems(order),
    total_str: formatAud(num(order.total)),
    gst_included_str: formatAud(num(order.tax_total)),
    address_lines: addressLines(order),
    admin_url: `${base}/app/orders/${order.id}`,
  }
}

/** Fields every order email reads. */
export const ORDER_EMAIL_FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "total",
  "tax_total",
  "shipping_total",
  "discount_total",
  "discount_tax_total",
  "customer.first_name",
  "customer.last_name",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.address_2",
  "shipping_address.city",
  "shipping_address.province",
  "shipping_address.postal_code",
  "shipping_address.country_code",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.total",
]
