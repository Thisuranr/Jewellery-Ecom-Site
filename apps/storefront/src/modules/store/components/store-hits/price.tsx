"use client"

import { indexedCurrency, priceAttribute } from "@lib/search-client"
import { convertToLocale } from "@lib/util/money"
import { clx } from "@modules/common/components/ui"

/** The per-currency price fields a hit may carry, e.g. `min_price_aud`. */
export type HitPricing = Record<string, unknown>

type HitPriceProps = {
  hit: HitPricing
  currencyCode: string
}

const amount = (value: unknown) => (typeof value === "number" ? value : null)

const HitPrice = ({ hit, currencyCode }: HitPriceProps) => {
  const currency_code = indexedCurrency(currencyCode)
  const min_price = amount(hit[priceAttribute("min_price", currencyCode)])
  const max_price = amount(hit[priceAttribute("max_price", currencyCode)])
  const original_price = amount(
    hit[priceAttribute("original_price", currencyCode)]
  )
  const on_sale = hit[priceAttribute("on_sale", currencyCode)] === true

  if (min_price === null) {
    return null
  }

  const format = (value: number) =>
    convertToLocale({ amount: value, currency_code })

  const max = max_price ?? min_price
  const isRange = max > min_price

  return (
    <div className="flex flex-wrap items-baseline gap-x-2" data-testid="product-price">
      {!isRange && on_sale && original_price !== null && (
        <span className="text-muted line-through" data-testid="original-price">
          {format(original_price)}
        </span>
      )}
      <span className={clx({ "text-sale": on_sale })} data-testid="price">
        {isRange ? `From ${format(min_price)}` : format(min_price)}
      </span>
    </div>
  )
}

export default HitPrice
