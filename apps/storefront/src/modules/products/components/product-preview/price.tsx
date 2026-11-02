import { clx } from "@modules/common/components/ui"
import { VariantPrice } from "types/global"

export default async function PreviewPrice({
  price,
  from,
}: {
  price: VariantPrice
  /** Variants are priced differently: say "From". */
  from?: boolean
}) {
  if (!price) {
    return null
  }

  const onSale = price.price_type === "sale"

  return (
    <div className="flex flex-wrap items-baseline gap-x-2" data-testid="product-price-wrap">
      {onSale && (
        <span className="text-muted line-through" data-testid="original-price">
          {price.original_price}
        </span>
      )}
      <span className={clx({ "text-sale": onSale })} data-testid="price">
        {from && !onSale ? "From " : ""}
        {price.calculated_price}
      </span>
    </div>
  )
}
