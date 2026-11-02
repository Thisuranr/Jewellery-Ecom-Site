"use client"

import { usePagination } from "react-instantsearch"

import { clx } from "@modules/common/components/ui"

const SearchPagination = () => {
  const { pages, currentRefinement, nbPages, refine, isFirstPage, isLastPage } =
    usePagination({ padding: 1 })

  if (nbPages <= 1) {
    return null
  }

  const go = (page: number) => {
    refine(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const arrow = "h-10 px-3 text-[12px] font-medium uppercase tracking-label transition-colors hover:text-ink disabled:cursor-default disabled:text-muted/40 disabled:hover:text-muted/40"

  return (
    <nav
      aria-label="Pagination"
      className="mt-14 flex justify-center"
      data-testid="product-pagination"
    >
      <div className="flex items-center gap-x-1 text-[14px]">
        <button
          type="button"
          className={clx(arrow, "text-ink")}
          disabled={isFirstPage}
          onClick={() => go(currentRefinement - 1)}
        >
          Prev
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            aria-current={page === currentRefinement ? "page" : undefined}
            disabled={page === currentRefinement}
            onClick={() => go(page)}
            className={clx(
              "h-10 min-w-10 px-2 transition-colors",
              page === currentRefinement
                ? "border-b border-ink text-ink"
                : "text-muted hover:text-ink"
            )}
          >
            {page + 1}
          </button>
        ))}
        <button
          type="button"
          className={clx(arrow, "text-ink")}
          disabled={isLastPage}
          onClick={() => go(currentRefinement + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}

export default SearchPagination
