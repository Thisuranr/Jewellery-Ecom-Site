/**
 * The figures the cart, checkout and order summaries show. Every price in the
 * store includes 10% GST, so these are Medusa's GST-inclusive totals and the
 * rows add up: items - discount + shipping = total. GST is shown as a part of
 * the total ("Includes GST of ..."), never added on top.
 *
 * Medusa's `discount_total` also counts shipping discounts, while
 * `shipping_total` is already after them, so the Discount row shows the item
 * discount only.
 */
export type TotalsInput = {
  total?: number | null
  tax_total?: number | null
  shipping_total?: number | null
  discount_total?: number | null
  item_total?: number | null
  original_item_total?: number | null
  item_discount_total?: number | null
  shipping_discount_total?: number | null
}

export type DisplayTotals = {
  items: number
  discount: number
  shipping: number
  total: number
  gst: number
}

export function getDisplayTotals(t: TotalsInput): DisplayTotals {
  const total = t.total ?? 0
  const shipping = t.shipping_total ?? 0
  const discount =
    t.item_discount_total ??
    Math.max(0, (t.discount_total ?? 0) - (t.shipping_discount_total ?? 0))
  const items =
    t.original_item_total ?? (t.item_total ?? total - shipping) + discount
  return { items, discount, shipping, total, gst: t.tax_total ?? 0 }
}
