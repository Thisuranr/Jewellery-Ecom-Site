import { getDisplayTotals } from "@lib/util/display-totals"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

const OrderSummary = ({ order }: OrderSummaryProps) => {
  const { items, discount, shipping, total, gst } = getDisplayTotals(order)
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: order.currency_code })

  return (
    <div>
      <h2 className="text-base-semi">Order Summary</h2>
      <div className="text-small-regular text-ui-fg-base my-2">
        <div className="flex items-center justify-between text-base-regular text-ui-fg-base mb-2">
          <span>Items</span>
          <span>{money(items)}</span>
        </div>
        <div className="flex flex-col gap-y-1">
          {discount > 0.004 && (
            <div className="flex items-center justify-between">
              <span>Discount</span>
              <span>- {money(discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span>{money(shipping)}</span>
          </div>
        </div>
        <div className="h-px w-full border-b border-gray-200 border-dashed my-4" />
        <div className="flex items-center justify-between text-base-regular text-ui-fg-base mb-2">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
        <div className="flex items-center justify-between text-ui-fg-subtle">
          <span>Includes GST of</span>
          <span>{money(gst)}</span>
        </div>
      </div>
    </div>
  )
}

export default OrderSummary
