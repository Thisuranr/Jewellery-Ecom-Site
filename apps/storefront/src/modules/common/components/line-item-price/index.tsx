import { getPercentageDiff } from "@lib/util/get-percentage-diff"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"

type LineItemPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
  currencyCode: string
}

const LineItemPrice = ({
  item,
  style = "default",
  currencyCode,
}: LineItemPriceProps) => {
  const { total, original_total } = item
  const originalPrice = original_total ?? 0
  const currentPrice = total ?? 0
  const hasReducedPrice = currentPrice < originalPrice

  return (
    <div className="flex flex-col items-end text-ink">
      {hasReducedPrice && (
        <span
          className="text-[13px] text-muted line-through"
          data-testid="product-original-price"
        >
          {convertToLocale({
            amount: originalPrice,
            currency_code: currencyCode,
          })}
        </span>
      )}
      <span
        className={clx("text-[15px] font-normal", {
          "text-sale": hasReducedPrice,
        })}
        data-testid="product-price"
      >
        {convertToLocale({
          amount: currentPrice,
          currency_code: currencyCode,
        })}
      </span>
      {hasReducedPrice && style === "default" && (
        <span className="text-[12px] text-sale">
          -{getPercentageDiff(originalPrice, currentPrice || 0)}%
        </span>
      )}
    </div>
  )
}

export default LineItemPrice
