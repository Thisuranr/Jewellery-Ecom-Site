import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { placeholderTypeFromText } from "@modules/common/components/placeholder"
import ProductCard from "../product-card"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({ product })

  const amounts = new Set(
    (product.variants ?? [])
      .map((v) => (v as { calculated_price?: { calculated_amount?: number } }).calculated_price?.calculated_amount)
      .filter((a): a is number => typeof a === "number")
  )

  const images = product.images ?? []
  const first = product.thumbnail || images[0]?.url
  const second = images.find((i) => i.url && i.url !== first)?.url

  return (
    <ProductCard
      href={`/products/${product.handle}`}
      title={product.title}
      thumbnail={first}
      hoverImage={second}
      placeholderType={placeholderTypeFromText(
        product.title,
        ...(product.categories ?? []).flatMap((c) => [c.name, c.handle])
      )}
      material={product.material}
      price={
        cheapestPrice ? (
          <PreviewPrice price={cheapestPrice} from={amounts.size > 1} />
        ) : null
      }
    />
  )
}
