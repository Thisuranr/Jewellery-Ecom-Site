import React, { Suspense } from "react"

import VariantImageGallery from "@modules/products/components/image-gallery/variant-image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductDetails from "@modules/products/components/product-details"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { placeholderTypeFromText } from "@modules/common/components/placeholder"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const REASSURANCE = [
  "Shipping Australia-wide",
  "30-day returns",
  "Secure checkout",
]

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const placeholderType = placeholderTypeFromText(
    product.title,
    ...(product.categories ?? []).flatMap((c) => [c.name, c.handle])
  )

  return (
    <>
      <div
        className="content-container grid grid-cols-1 gap-x-16 gap-y-8 pb-12 pt-6 small:grid-cols-[minmax(0,1fr)_minmax(0,440px)] small:items-start small:pt-10 medium:gap-x-24"
        data-testid="product-container"
      >
        <div className="min-w-0">
          <VariantImageGallery
            product={product}
            placeholderType={placeholderType}
          />
        </div>

        <div className="flex flex-col gap-y-8 small:sticky small:top-40">
          <ProductOnboardingCta />
          <div className="flex flex-col gap-y-6">
            <ProductInfo product={product} />
            <ProductActions product={product} region={region} />
          </div>

          <ul
            className="flex flex-col gap-y-2 border-y border-hairline py-5 text-[14px] font-light text-muted"
            data-testid="product-reassurance"
          >
            {REASSURANCE.map((line) => (
              <li key={line} className="flex items-center gap-x-3">
                <span aria-hidden className="h-px w-4 bg-accent" />
                {line}
              </li>
            ))}
          </ul>

          <ProductDetails productId={product.id} />
          <ProductTabs product={product} />

          <LocalizedClientLink
            href={`/custom-order?product=${encodeURIComponent(product.handle ?? "")}`}
            className="label self-start text-ink link-fade"
            data-testid="product-enquire-link"
          >
            Enquire about customising this piece &rarr;
          </LocalizedClientLink>
        </div>
      </div>
      <div
        className="content-container mb-20 mt-12 small:mb-28"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
