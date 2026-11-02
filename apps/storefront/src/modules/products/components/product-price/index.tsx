import { clx } from "@modules/common/components/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block h-9 w-32 animate-pulse bg-surface-dark" />
  }

  const onSale = selectedPrice.price_type === "sale"

  return (
    <div className="flex flex-col gap-y-1 text-ink">
      <div className="flex items-baseline gap-x-3">
        <span className={clx("text-[24px] font-light", { "text-sale": onSale })}>
          {!variant && <span className="mr-2 text-[15px] text-muted">From</span>}
          <span
            data-testid="product-price"
            data-value={selectedPrice.calculated_price_number}
          >
            {selectedPrice.calculated_price}
          </span>
        </span>
        {onSale && (
          <>
            <span
              className="text-[15px] text-muted line-through"
              data-testid="original-product-price"
              data-value={selectedPrice.original_price_number}
            >
              {selectedPrice.original_price}
            </span>
            <span className="text-[13px] text-sale">
              -{selectedPrice.percentage_diff}%
            </span>
          </>
        )}
      </div>
      <p className="text-[12px] font-light text-muted">Includes GST</p>
    </div>
  )
}
