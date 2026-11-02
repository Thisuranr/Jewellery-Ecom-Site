import { notFound } from "next/navigation"

import CategoryListing from "@modules/categories/components/category-listing"
import { listCategoryFilterAttributes } from "@lib/data/filter-attributes"
import { getRegion } from "@lib/data/regions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

export default async function CategoryTemplate({
  category,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  countryCode: string
}) {
  if (!category || !countryCode) notFound()

  const [region, attributes] = await Promise.all([
    getRegion(countryCode),
    listCategoryFilterAttributes(category.id),
  ])

  if (!region) notFound()

  const parents = [] as HttpTypes.StoreProductCategory[]

  const getParents = (category: HttpTypes.StoreProductCategory) => {
    if (category.parent_category) {
      parents.push(category.parent_category)
      getParents(category.parent_category)
    }
  }

  getParents(category)

  const crumbs = [...parents].reverse()

  return (
    <div className="content-container py-10 small:py-14" data-testid="category-container">
      <header className="mb-8 small:mb-10">
        <nav
          aria-label="Breadcrumb"
          className="label mb-4 flex flex-wrap items-center gap-x-2 text-muted"
        >
          <LocalizedClientLink href="/store" className="transition-colors hover:text-ink">
            Shop
          </LocalizedClientLink>
          {crumbs.map((parent) => (
            <span key={parent.id} className="flex items-center gap-x-2">
              <span aria-hidden>/</span>
              <LocalizedClientLink
                href={`/categories/${parent.handle}`}
                className="transition-colors hover:text-ink"
                data-testid="sort-by-link"
              >
                {parent.name}
              </LocalizedClientLink>
            </span>
          ))}
        </nav>
        <h1
          className="font-display text-[38px] font-normal leading-[1.1] small:text-[52px]"
          data-testid="category-page-title"
        >
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-xl text-muted">{category.description}</p>
        )}
        {!!category.category_children?.length && (
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2" data-testid="subcategory-links">
            {category.category_children.map((c) => (
              <li key={c.id}>
                <LocalizedClientLink
                  href={`/categories/${c.handle}`}
                  className="label text-ink link-fade"
                >
                  {c.name}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        )}
      </header>

      <CategoryListing
        categoryId={category.id}
        currencyCode={region.currency_code}
        attributes={attributes}
      />
    </div>
  )
}
