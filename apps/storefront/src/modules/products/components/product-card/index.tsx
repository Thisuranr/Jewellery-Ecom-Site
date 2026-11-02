import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { PlaceholderType } from "@modules/common/components/placeholder"
import Thumbnail from "@modules/products/components/thumbnail"

type ProductCardProps = {
  href: string
  title: string
  thumbnail?: string | null
  /** Second photo, shown on hover when there is one. */
  hoverImage?: string | null
  placeholderType?: PlaceholderType
  /** Small muted line under the name, e.g. "Gold plated". */
  material?: string | null
  /** The price block (already formatted, may say "From ..."). */
  price?: React.ReactNode
}

/** The one product card: 4:5 image, name, quiet material line, price. */
export default function ProductCard({
  href,
  title,
  thumbnail,
  hoverImage,
  placeholderType,
  material,
  price,
}: ProductCardProps) {
  return (
    <LocalizedClientLink href={href} className="group block">
      <div data-testid="product-wrapper">
        <Thumbnail
          thumbnail={thumbnail}
          hoverImage={hoverImage}
          alt={title}
          size="full"
          placeholderType={placeholderType}
        />
        <div className="mt-4 flex flex-col gap-y-0.5">
          <p
            className="text-[14px] font-normal leading-6 text-ink"
            data-testid="product-title"
          >
            {title}
          </p>
          {material && (
            <p className="text-[12px] font-light leading-4 text-muted">
              {material}
            </p>
          )}
          {price && (
            <div className="mt-1 text-[14px] font-light text-ink">{price}</div>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  )
}
