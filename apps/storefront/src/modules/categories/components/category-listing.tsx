"use client"

import type { SearchClient } from "instantsearch.js"
import { Configure, InstantSearch } from "react-instantsearch"

import { PRODUCT_INDEX_NAME, searchClient } from "@lib/search-client"
import type { FilterAttribute } from "@lib/util/filter-attributes"
import StoreHits from "@modules/store/components/store-hits"
import StoreRefinements from "@modules/store/components/store-refinements"

const PRODUCT_LIMIT = 12

/**
 * A category's products from the search index (the category and everything
 * below it), with sort, price, option and attribute filters.
 */
const CategoryListing = ({
  categoryId,
  currencyCode,
  attributes,
}: {
  categoryId: string
  currencyCode: string
  attributes: FilterAttribute[]
}) => {
  return (
    <InstantSearch
      indexName={PRODUCT_INDEX_NAME}
      searchClient={searchClient as unknown as SearchClient}
      routing
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <Configure
        hitsPerPage={PRODUCT_LIMIT}
        facetFilters={[`category_ids:${categoryId}`]}
      />
      <StoreRefinements
        currencyCode={currencyCode}
        attributes={attributes}
        hideCategory
      />
      <StoreHits
        hitsPerPage={PRODUCT_LIMIT}
        currencyCode={currencyCode}
        attributes={attributes}
      />
    </InstantSearch>
  )
}

export default CategoryListing
