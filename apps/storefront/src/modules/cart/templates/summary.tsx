"use client"

import CartTotals from "@modules/common/components/cart-totals"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-6">
      <h2 className="font-display text-[26px] font-normal leading-tight">
        Summary
      </h2>
      <DiscountCode cart={cart} />
      <CartTotals totals={cart} />
      <LocalizedClientLink
        href={"/checkout?step=" + step}
        className="btn-solid w-full"
        data-testid="checkout-button"
      >
        Go to checkout
      </LocalizedClientLink>
      <p className="text-center text-[12px] font-light text-muted">
        Secure checkout. 30-day returns.
      </p>
    </div>
  )
}

export default Summary
