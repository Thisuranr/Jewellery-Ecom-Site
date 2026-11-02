import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const category = product.categories?.[0]

  return (
    <div id="product-info" className="flex flex-col gap-y-3">
      {category ? (
        <LocalizedClientLink
          href={`/categories/${category.handle}`}
          className="label text-muted transition-colors hover:text-ink"
          data-testid="product-category-link"
        >
          {category.name}
        </LocalizedClientLink>
      ) : (
        product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="label text-muted transition-colors hover:text-ink"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )
      )}
      <h1
        className="font-display text-[34px] font-normal leading-[1.1] text-ink small:text-[44px]"
        data-testid="product-title"
      >
        {product.title}
      </h1>
    </div>
  )
}

export default ProductInfo
