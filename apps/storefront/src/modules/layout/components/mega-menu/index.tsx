"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  NEWEST_QUERY,
  attrQuery,
  type NavCategory,
  type NavFilterLink,
} from "@lib/util/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Placeholder, {
  placeholderTypeFromText,
} from "@modules/common/components/placeholder"
import { clx } from "@modules/common/components/ui"

/** Top-level categories shown inline; the rest go under "More". */
export const INLINE_CATEGORY_COUNT = 5
const MORE_ID = "__more"

const OPEN_DELAY = 120
const CLOSE_DELAY = 160

const linkClass =
  "block py-[5px] text-[14px] font-normal leading-6 text-ink underline decoration-transparent decoration-1 underline-offset-4 transition-colors duration-200 ease-out hover:decoration-ink"
const headClass = "label mb-4 block text-muted"
const triggerClass =
  "label relative flex h-12 items-center whitespace-nowrap text-ink transition-colors duration-200 ease-out after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-200 hover:after:scale-x-100 aria-expanded:after:scale-x-100"

const filterHref = (base: string, value: string) =>
  `${base}?${attrQuery(value)}`

const FilterColumn = ({
  title,
  base,
  links,
}: {
  title: string
  base: string
  links: NavFilterLink[]
}) => (
  <div>
    <span className={headClass}>{title}</span>
    <ul>
      {links.map((l) => (
        <li key={l.value}>
          <LocalizedClientLink
            href={filterHref(base, l.value)}
            className={linkClass}
            data-testid="mega-filter-link"
          >
            {l.label}
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  </div>
)

const CategoryPanel = ({
  category,
  materials,
  colours,
}: {
  category: NavCategory
  materials: NavFilterLink[]
  colours: NavFilterLink[]
}) => {
  const base = `/categories/${category.handle}`
  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-[1fr_1fr_1fr_240px] gap-x-12 px-12 py-10">
      <div>
        <span className={headClass}>Style</span>
        <ul>
          <li>
            <LocalizedClientLink
              href={base}
              className={clx(linkClass, "!font-medium")}
            >
              Shop all {category.name}
            </LocalizedClientLink>
          </li>
          {category.children.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/categories/${c.handle}`}
                className={linkClass}
              >
                {c.name}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </div>
      <FilterColumn title="Shop by material" base={base} links={materials} />
      <FilterColumn title="Shop by colour" base={base} links={colours} />
      <LocalizedClientLink href={base} className="group block">
        <Placeholder
          type={placeholderTypeFromText(category.name, category.handle)}
          tone="mid"
          ratio="4 / 5"
        />
        <span className="label mt-3 block text-ink link-fade">
          Shop {category.name}
        </span>
      </LocalizedClientLink>
    </div>
  )
}

const MorePanel = ({ categories }: { categories: NavCategory[] }) => (
  <div className="mx-auto grid max-w-[1280px] grid-cols-4 gap-x-12 gap-y-10 px-12 py-10">
    {categories.map((c) => (
      <div key={c.id}>
        <LocalizedClientLink
          href={`/categories/${c.handle}`}
          className="label mb-4 block text-ink link-fade"
        >
          {c.name}
        </LocalizedClientLink>
        {c.children.length > 0 && (
          <ul>
            {c.children.map((ch) => (
              <li key={ch.id}>
                <LocalizedClientLink
                  href={`/categories/${ch.handle}`}
                  className={linkClass}
                >
                  {ch.name}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    ))}
  </div>
)

export default function MegaMenu({
  categories,
  materials,
  colours,
}: {
  categories: NavCategory[]
  materials: NavFilterLink[]
  colours: NavFilterLink[]
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const openedAt = useRef(0)
  const rootRef = useRef<HTMLUListElement>(null)
  const activeRef = useRef<string | null>(null)
  activeRef.current = activeId
  const pathname = usePathname()

  const inline = categories.slice(0, INLINE_CATEGORY_COUNT)
  const more = categories.slice(INLINE_CATEGORY_COUNT)

  const clear = () => window.clearTimeout(timer.current)

  const openNow = useCallback((id: string) => {
    window.clearTimeout(timer.current)
    if (activeRef.current !== id) openedAt.current = Date.now()
    setActiveId(id)
  }, [])

  const openSoon = (id: string) => {
    clear()
    // Switching between panels is instant; the first open waits a beat so a
    // mouse crossing the bar does not flash a panel.
    timer.current = window.setTimeout(
      () => openNow(id),
      activeRef.current ? 0 : OPEN_DELAY
    )
  }

  const closeSoon = () => {
    clear()
    timer.current = window.setTimeout(() => setActiveId(null), CLOSE_DELAY)
  }

  // Close on navigation.
  useEffect(() => {
    window.clearTimeout(timer.current)
    setActiveId(null)
  }, [pathname])

  // Esc closes (and returns focus to the trigger); a click outside closes.
  useEffect(() => {
    if (!activeId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const id = activeRef.current
      setActiveId(null)
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-trigger="${id}"]`)
        ?.focus()
    }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setActiveId(null)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [activeId])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // A plain function (not a component) so the DOM, and focus, survive re-renders.
  const renderItem = (id: string, label: string, panel: React.ReactNode) => {
    const open = activeId === id
    return (
      <li
        key={id}
        onMouseEnter={() => openSoon(id)}
        onMouseLeave={closeSoon}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setActiveId((cur) => (cur === id ? null : cur))
          }
        }}
      >
        <button
          type="button"
          data-trigger={id}
          aria-expanded={open}
          aria-controls={`mega-${id}`}
          className={triggerClass}
          onFocus={() => openNow(id)}
          onClick={() => {
            // Hover or focus has usually just opened it; only a deliberate
            // second click closes it.
            if (open && Date.now() - openedAt.current > 400) setActiveId(null)
            else openNow(id)
          }}
          data-testid={`nav-trigger-${id}`}
        >
          {label}
        </button>
        <div
          id={`mega-${id}`}
          className={clx(
            "absolute inset-x-0 top-full border-b border-strong bg-white transition-[opacity,visibility] duration-200 ease-out",
            open ? "visible opacity-100" : "invisible opacity-0"
          )}
          data-testid={`mega-panel-${id}`}
        >
          {panel}
        </div>
      </li>
    )
  }

  return (
    <ul
      ref={rootRef}
      className="flex items-center justify-center gap-x-5 medium:gap-x-8"
    >
      {/* Very light dim under the open panel so it separates from the page. */}
      <li
        aria-hidden
        className={clx(
          "pointer-events-none absolute inset-x-0 top-full h-screen bg-black/[0.10] transition-[opacity,visibility] duration-200 ease-out",
          activeId ? "visible opacity-100" : "invisible opacity-0"
        )}
      />
      <li>
        <LocalizedClientLink
          href={`/store?${NEWEST_QUERY}`}
          className={triggerClass}
          data-testid="nav-new-in"
        >
          New in
        </LocalizedClientLink>
      </li>
      {inline.map((c) =>
        c.children.length ? (
          renderItem(
            c.id,
            c.name,
            <CategoryPanel
              category={c}
              materials={materials}
              colours={colours}
            />
          )
        ) : (
          <li key={c.id}>
            <LocalizedClientLink
              href={`/categories/${c.handle}`}
              className={triggerClass}
            >
              {c.name}
            </LocalizedClientLink>
          </li>
        )
      )}
      {more.length > 0 && (
        renderItem(MORE_ID, "More", <MorePanel categories={more} />)
      )}
      <li>
        <LocalizedClientLink
          href="/custom-order"
          className={triggerClass}
          data-testid="nav-custom-orders"
        >
          Custom orders
        </LocalizedClientLink>
      </li>
    </ul>
  )
}
