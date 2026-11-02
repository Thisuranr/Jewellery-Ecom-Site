"use client"

import { getDisplayTotals, type TotalsInput } from "@lib/util/display-totals"
import { convertToLocale } from "@lib/util/money"
import React from "react"

type CartTotalsProps = {
  totals: TotalsInput & { currency_code: string }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const { currency_code } = totals
  const { items, discount, shipping, total, gst } = getDisplayTotals(totals)
  const money = (amount: number) => convertToLocale({ amount, currency_code })

  return (
    <div>
      <div className="flex flex-col gap-y-3 text-[14px] text-muted">
        <div className="flex items-center justify-between">
          <span>Items</span>
          <span data-testid="cart-subtotal" data-value={items}>
            {money(items)}
          </span>
        </div>
        {discount > 0.004 && (
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span
              className="text-ink"
              data-testid="cart-discount"
              data-value={discount}
            >
              - {money(discount)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>Shipping</span>
          <span data-testid="cart-shipping" data-value={shipping}>
            {money(shipping)}
          </span>
        </div>
      </div>
      <div className="my-4 h-px w-full bg-hairline" />
      <div className="mb-2 flex items-baseline justify-between text-[15px] text-ink">
        <span>Total</span>
        <span
          className="text-[22px]"
          data-testid="cart-total"
          data-value={total}
        >
          {money(total)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span>Includes GST of</span>
        <span data-testid="cart-taxes" data-value={gst}>
          {money(gst)}
        </span>
      </div>
      
    </div>
  )
}

export default CartTotals
