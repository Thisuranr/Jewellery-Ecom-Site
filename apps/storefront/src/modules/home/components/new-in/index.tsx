import { listProducts } from "@lib/data/products"
import { NEWEST_QUERY } from "@lib/util/navigation"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductPreview from "@modules/products/components/product-preview"

export default async function NewIn({
  region,
}: {
  region: HttpTypes.StoreRegion
}) {
  const products = await listProducts({
    regionId: region.id,
    queryParams: {
      limit: 4,
      order: "-created_at",
      fields: "*variants.calculated_price,*categories",
    },
  })
    .then(({ response }) => response.products)
    .catch(() => [])

  if (!products.length) return null

  return (
    <section className="content-container py-16 small:py-24">
      <div className="mb-10 flex items-end justify-between gap-x-6">
        <h2 className="section-title">New in</h2>
        <LocalizedClientLink
          href={`/store?${NEWEST_QUERY}`}
          className="label text-ink link-fade"
        >
          View all
        </LocalizedClientLink>
      </div>
      <ul
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 sm:scroll-px-8 small:scroll-px-0 gap-x-4 overflow-x-auto px-4 no-scrollbar sm:-mx-8 sm:px-8 small:mx-0 small:grid small:grid-cols-4 small:gap-x-6 small:overflow-visible small:px-0"
        data-testid="home-new-in"
      >
        {products.map((product) => (
          <li
            key={product.id}
            className="w-[68%] shrink-0 snap-start sm:w-[42%] small:w-auto"
          >
            <ProductPreview product={product} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </section>
  )
}
