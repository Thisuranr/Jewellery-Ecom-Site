"use client"

import type { SearchClient } from "instantsearch.js"
import { Configure, InstantSearch } from "react-instantsearch"

import { PRODUCT_INDEX_NAME, searchClient } from "@lib/search-client"
import type { FilterAttribute } from "@lib/util/filter-attributes"
import StoreHits from "@modules/store/components/store-hits"
import StoreRefinements from "@modules/store/components/store-refinements"
import StoreSearchBox from "@modules/store/components/store-search-box"

const PRODUCT_LIMIT = 12

const StoreTemplate = ({
  currencyCode,
  attributes = [],
}: {
  currencyCode: string
  attributes?: FilterAttribute[]
}) => {
  return (
    <div className="content-container py-10 small:py-14" data-testid="category-container">
      <header className="mb-8 small:mb-10">
        <h1
          className="font-display text-[38px] font-normal leading-[1.1] small:text-[52px]"
          data-testid="store-page-title"
        >
          All jewellery
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Rings, earrings, necklaces and bracelets, each in a choice of metals
          and sizes.
        </p>
      </header>

      <InstantSearch
        indexName={PRODUCT_INDEX_NAME}
        searchClient={searchClient as unknown as SearchClient}
        routing
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <Configure hitsPerPage={PRODUCT_LIMIT} />
        <StoreSearchBox />
        <StoreRefinements currencyCode={currencyCode} attributes={attributes} />
        <StoreHits
          hitsPerPage={PRODUCT_LIMIT}
          currencyCode={currencyCode}
          attributes={attributes}
        />
      </InstantSearch>
    </div>
  )
}

export default StoreTemplate
