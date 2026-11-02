"use client"

import type { Hit } from "instantsearch.js"
import { useEffect, useRef } from "react"
import {
  useClearRefinements,
  useHits,
  useInstantSearch,
} from "react-instantsearch"

import useSearchSettled from "@lib/hooks/use-search-settled"
import type { FilterAttribute } from "@lib/util/filter-attributes"
import ProductCard from "@modules/products/components/product-card"
import { placeholderTypeFromText } from "@modules/common/components/placeholder"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import SearchPagination from "./pagination"
import HitPrice, { HitPricing } from "./price"

type ProductHit = Hit<
  {
    title: string | null
    handle: string | null
    thumbnail: string | null
  } & HitPricing
>

type StoreHitsProps = {
  hitsPerPage: number
  currencyCode: string
  attributes?: FilterAttribute[]
}

/** "material_type:gold_plated" -> "Gold plated", using the attribute's own labels. */
const materialOf = (attr: unknown, labels: Map<string, string>) => {
  if (!Array.isArray(attr)) return null
  const value = (attr as string[]).find((a) => labels.has(a))
  return value ? labels.get(value)! : null
}

const StoreHits = ({
  hitsPerPage,
  currencyCode,
  attributes = [],
}: StoreHitsProps) => {
  const { canRefine: canClear, refine: clearAll } = useClearRefinements()
  const materialLabels = new Map(
    attributes
      .filter((a) => a.handle === "material_type")
      .flatMap((a) => a.options.map((o) => [o.value, o.label] as const))
  )
  const { items } = useHits<ProductHit>()
  const { status, error, indexUiState } = useInstantSearch()
  const { isSearching, hasNoResultsYet } = useSearchSettled()

  const { page, ...refinements } = indexUiState
  const currentPage = page ?? 1
  const refinementKey = JSON.stringify(refinements)

  const settled = useRef({ page: currentPage, refinementKey })

  useEffect(() => {
    if (!isSearching) {
      settled.current = { page: currentPage, refinementKey }
    }
  }, [isSearching, currentPage, refinementKey])

  const isPagingOnly =
    refinementKey === settled.current.refinementKey &&
    currentPage !== settled.current.page

  const showSkeleton = hasNoResultsYet || (isSearching && isPagingOnly)

  if (status === "error") {
    return (
      <p
        className="py-16 text-center text-[#b42318]"
        data-testid="products-error"
      >
        Couldn&apos;t load products
        {error?.message ? `: ${error.message}` : "."}
      </p>
    )
  }

  return (
    <>
      {showSkeleton ? (
        <SkeletonProductGrid numberOfProducts={hitsPerPage} />
      ) : !items.length ? (
        <div
          className="flex flex-col items-center gap-y-5 py-24 text-center"
          data-testid="no-products"
        >
          <p className="font-display text-[28px] leading-tight">
            No pieces match these filters
          </p>
          <p className="max-w-sm text-muted">
            Try removing a filter or two to see more of the collection.
          </p>
          {canClear && (
            <button
              type="button"
              onClick={() => clearAll()}
              className="btn-outline"
              data-testid="empty-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul
          className="grid w-full grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-5 medium:grid-cols-4 medium:gap-x-6"
          data-testid="products-list"
        >
          {items.map((hit) =>
            hit.handle ? (
              <li key={hit.objectID}>
                <ProductCard
                  href={`/products/${hit.handle}`}
                  title={hit.title ?? ""}
                  thumbnail={hit.thumbnail}
                  placeholderType={placeholderTypeFromText(
                    hit.title,
                    ...(Array.isArray(hit.category)
                      ? (hit.category as string[])
                      : [])
                  )}
                  material={materialOf(hit.attr, materialLabels)}
                  price={<HitPrice hit={hit} currencyCode={currencyCode} />}
                />
              </li>
            ) : null
          )}
        </ul>
      )}
      <SearchPagination />
    </>
  )
}

export default StoreHits
