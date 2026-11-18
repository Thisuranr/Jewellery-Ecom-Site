import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import CheckoutPausedNote from "@modules/checkout/components/checkout-paused-note"
import { CHECKOUT_PAUSED } from "@lib/checkout-paused"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

export default async function Checkout() {
  // Preview mode: no steps, no payment form. The backend refuses to complete a cart as well.
  if (CHECKOUT_PAUSED) {
    return (
      <div className="content-container py-16 small:py-24">
        <div className="mx-auto max-w-[520px]">
          <CheckoutPausedNote />
        </div>
      </div>
    )
  }

  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  return (
    <div className="content-container grid grid-cols-1 gap-y-10 py-10 small:grid-cols-[minmax(0,1fr)_400px] small:gap-x-16 small:py-16 medium:gap-x-24">
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
