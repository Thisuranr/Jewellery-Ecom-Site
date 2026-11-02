"use client"

import { MagnifyingGlass, XMarkMini } from "@medusajs/icons"
import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchBox } from "react-instantsearch"

const DEBOUNCE_MS = 250

/**
 * Free-text search over the listing, refining the same InstantSearch state the
 * sidebar filters do. The input is held locally so typing stays responsive
 * while the query itself is debounced.
 */
const StoreSearchBox = () => {
  const timer = useRef<number | undefined>(undefined)

  const queryHook = useCallback(
    (nextQuery: string, search: (value: string) => void) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => search(nextQuery), DEBOUNCE_MS)
    },
    []
  )

  const { query, refine } = useSearchBox({ queryHook })
  const [inputValue, setInputValue] = useState(query)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Follow the query when it changes elsewhere — cleared with the filters, or
  // arriving from the URL on load, which `routing` restores after mount.
  useEffect(() => {
    setInputValue(query)
  }, [query])

  const clear = () => {
    window.clearTimeout(timer.current)
    setInputValue("")
    refine("")
  }

  return (
    <div className="mb-6 flex items-center gap-x-3 border-b border-hairline">
      <MagnifyingGlass className="shrink-0 text-muted" />
      <input
        type="search"
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value)
          refine(event.target.value)
        }}
        placeholder="Search products"
        aria-label="Search products"
        className="w-full text-[15px] font-light bg-transparent py-3 text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        data-testid="store-search-input"
      />
      {inputValue && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="shrink-0 text-muted hover:text-ink"
          data-testid="store-search-clear"
        >
          <XMarkMini />
        </button>
      )}
    </div>
  )
}

export default StoreSearchBox
