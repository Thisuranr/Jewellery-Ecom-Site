"use client"

import { useState } from "react"
import {
  useCurrentRefinements,
  useClearRefinements,
  useSortBy,
  useStats,
} from "react-instantsearch"

import type { FilterAttribute } from "@lib/util/filter-attributes"
import Drawer from "@modules/common/components/drawer"
import {
  CATEGORY_ATTRIBUTE,
  LABELS_ATTRIBUTE,
  getSortOptions,
} from "./attributes"
import AttributeRefinements from "./attribute-refinements"
import CurrentRefinements from "./current-refinements"
import OnSaleToggle from "./on-sale-toggle"
import OptionRefinements from "./option-refinements"
import PriceRange from "./price-range"
import RefinementGroup from "./refinement-group"

const SortProducts = ({ currencyCode }: { currencyCode: string }) => {
  const items = getSortOptions(currencyCode)
  const { currentRefinement, refine } = useSortBy({ items })

  return (
    <div
      className="flex items-center gap-x-2"
      data-testid="sort-by-container"
    >
      <label
        htmlFor="listing-sort"
        className="hidden text-[12px] font-medium uppercase tracking-[0.12em] text-muted sm:block"
      >
        Sort
      </label>
      <div className="relative">
        <select
          id="listing-sort"
          value={currentRefinement}
          onChange={(e) => refine(e.target.value)}
          className="h-10 cursor-pointer appearance-none border border-strong bg-white pl-3 pr-8 text-[14px] font-light text-ink outline-none transition-colors hover:border-ink focus:border-ink"
        >
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}

/**
 * Listing controls: a Filter button (with the number of active filters) that
 * opens a left drawer, a compact sort select, and the active filters as
 * chips. The filter widgets stay mounted while the drawer is closed so the
 * URL state keeps applying.
 */
const StoreRefinements = ({
  currencyCode,
  attributes = [],
  hideCategory = false,
}: {
  currencyCode: string
  attributes?: FilterAttribute[]
  hideCategory?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const { items } = useCurrentRefinements()
  const { canRefine: canClear, refine: clearAll } = useClearRefinements()
  const { nbHits } = useStats()
  const count = items.flatMap((item) => item.refinements).length

  return (
    <div className="mb-8 flex flex-col gap-y-4" data-testid="listing-controls">
      <div className="flex items-center justify-between gap-x-4 border-y border-hairline py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 items-center gap-x-2 border border-ink px-5 text-[12px] font-medium uppercase tracking-label transition-colors hover:bg-surface"
          aria-haspopup="dialog"
          data-testid="filter-button"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          Filter
          {count > 0 && (
            <span
              className="ml-0.5 flex h-5 min-w-5 items-center justify-center bg-ink px-1 text-[11px] leading-none text-white"
              data-testid="filter-count"
            >
              {count}
            </span>
          )}
        </button>

        <p className="hidden flex-1 text-[13px] font-light text-muted sm:block">
          {nbHits} {nbHits === 1 ? "piece" : "pieces"}
        </p>

        <SortProducts currencyCode={currencyCode} />
      </div>

      <CurrentRefinements currencyCode={currencyCode} />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        title="Filter"
        keepMounted
        data-testid="filter-drawer"
        closeTestId="close-filter-drawer"
        footer={
          <div className="flex gap-x-3">
            <button
              type="button"
              onClick={() => clearAll()}
              disabled={!canClear}
              className="btn-outline flex-1 !px-4 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="drawer-clear-all"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-solid flex-[1.4] !px-4"
              data-testid="drawer-show-results"
            >
              Show {nbHits} {nbHits === 1 ? "piece" : "pieces"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col divide-y divide-hairline px-6">
          <AttributeRefinements attributes={attributes} />
          <OptionRefinements />
          <PriceRange currencyCode={currencyCode} />
          <OnSaleToggle currencyCode={currencyCode} />
          {!hideCategory && (
            <RefinementGroup attribute={CATEGORY_ATTRIBUTE} title="Category" />
          )}
          <RefinementGroup attribute={LABELS_ATTRIBUTE} title="Labels" />
        </div>
      </Drawer>
    </div>
  )
}

export default StoreRefinements
