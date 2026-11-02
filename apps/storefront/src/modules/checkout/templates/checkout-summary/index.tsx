import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import CartTotals from "@modules/common/components/cart-totals"
import { HttpTypes } from "@medusajs/types"

const CheckoutSummary = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  return (
    <div className="small:sticky small:top-8 small:self-start">
      <div className="flex w-full flex-col gap-y-6 bg-surface p-6 small:p-8">
        <h2 className="font-display text-[26px] font-normal leading-tight">
          Your order
        </h2>
        <ItemsPreviewTemplate cart={cart} />
        <div className="h-px w-full bg-hairline" />
        <DiscountCode cart={cart} />
        <CartTotals totals={cart} />
      </div>
    </div>
  )
}

export default CheckoutSummary
