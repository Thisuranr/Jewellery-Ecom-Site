import { Metadata } from "next"
import { notFound } from "next/navigation"

import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import SearchForm from "@modules/search/components/search-form"

const RESULT_LIMIT = 24

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ q?: string | string[] }>
}

const getQuery = (q?: string | string[]) =>
  (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 200) ?? ""

export async function generateMetadata(props: Props): Promise<Metadata> {
  const query = getQuery((await props.searchParams).q)
  return {
    title: query ? `Search results for "${query}"` : "Search",
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage(props: Props) {
  const { countryCode } = await props.params
  const query = getQuery((await props.searchParams).q)

  const region = await getRegion(countryCode)
  if (!region) {
    notFound()
  }

  const { response } = query
    ? await listProducts({
        countryCode,
        queryParams: { q: query, limit: RESULT_LIMIT },
      })
    : { response: { products: [], count: 0 } }

  return (
    <div className="content-container py-10 small:py-14" data-testid="search-container">
      <h1 className="mb-6 font-display text-[38px] font-normal leading-[1.1] small:text-[52px]">
        {query ? `Results for “${query}”` : "Search"}
      </h1>
      <SearchForm countryCode={countryCode} defaultValue={query} className="mb-8 max-w-xl" />
      {query && (
        <p className="mb-8 text-[13px] font-light text-muted">
          {response.count} {response.count === 1 ? "piece" : "pieces"} found
        </p>
      )}
      {query && response.products.length === 0 ? (
        <p className="py-10 text-muted">
          No pieces match your search. Try a different keyword.
        </p>
      ) : (
        <ul
          className="grid w-full grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 medium:grid-cols-4 medium:gap-x-6"
          data-testid="search-results"
        >
          {response.products.map((product) => (
            <li key={product.id}>
              <ProductPreview product={product} region={region} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
