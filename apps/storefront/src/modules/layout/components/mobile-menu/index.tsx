"use client"

import { Dialog, Transition } from "@headlessui/react"
import { usePathname, useRouter, useParams } from "next/navigation"
import { Fragment, useEffect, useState } from "react"

import {
  NEWEST_QUERY,
  attrQuery,
  type NavCategory,
  type NavFilterLink,
} from "@lib/util/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
} from "../icons"

const row =
  "flex min-h-[52px] w-full items-center justify-between border-b border-hairline px-6 text-left text-[16px] font-normal text-ink transition-colors duration-200 hover:bg-surface"
const groupHead = "label block px-6 pb-2 pt-8 text-muted"
const subRow =
  "flex min-h-[48px] items-center border-b border-hairline px-6 text-[15px] font-normal text-ink transition-colors duration-200 hover:bg-surface"

export default function MobileMenu({
  categories,
  materials,
  colours,
  storeName,
}: {
  categories: NavCategory[]
  materials: NavFilterLink[]
  colours: NavFilterLink[]
  storeName: string
}) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const pathname = usePathname()
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()

  const close = () => {
    setOpen(false)
    setTimeout(() => setActiveId(null), 300)
  }

  // Close when the route changes (a link was followed).
  useEffect(() => {
    setOpen(false)
    setActiveId(null)
  }, [pathname])

  const active = categories.find((c) => c.id === activeId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    close()
    router.push(`/${countryCode}/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-ml-2 flex h-11 w-11 items-center justify-center text-ink"
        data-testid="nav-menu-button"
      >
        <MenuIcon size={24} />
      </button>

      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-[80]" onClose={close}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden />
          </Transition.Child>

          <Transition.Child
            as={Fragment}
            enter="transform transition ease-out duration-300"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in duration-200"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel
              className="fixed inset-y-0 left-0 flex w-[min(88vw,400px)] flex-col overflow-hidden bg-white"
              data-testid="nav-menu-popup"
            >
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline pl-6 pr-4">
                <span className="font-display text-[22px] uppercase tracking-[0.2em]">
                  {storeName}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center"
                  data-testid="close-menu-button"
                >
                  <CloseIcon size={22} />
                </button>
              </div>

              <form
                onSubmit={submit}
                role="search"
                className="shrink-0 border-b border-hairline px-6 py-4"
              >
                <label className="flex items-center gap-x-3 border border-hairline px-3 transition-colors duration-200 focus-within:border-ink">
                  <SearchIcon size={18} className="shrink-0 text-muted" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    aria-label="Search products"
                    className="h-11 w-full bg-transparent text-[15px] font-normal outline-none placeholder:text-muted"
                    data-testid="mobile-search-input"
                  />
                </label>
              </form>

              {/* Two sliding levels */}
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div
                  className="flex h-full w-[200%] transition-transform duration-300 ease-out"
                  style={{
                    transform: active ? "translateX(-50%)" : "translateX(0)",
                  }}
                >
                  {/* Level 1 */}
                  <div
                    className="h-full w-1/2 overflow-y-auto"
                    aria-hidden={!!active}
                    inert={!!active}
                  >
                    <ul>
                      <li>
                        <LocalizedClientLink
                          href={`/store?${NEWEST_QUERY}`}
                          className={row}
                        >
                          New in
                        </LocalizedClientLink>
                      </li>
                      {categories.map((c) => (
                        <li key={c.id}>
                          {c.children.length ? (
                            <button
                              type="button"
                              className={row}
                              onClick={() => setActiveId(c.id)}
                              data-testid={`mobile-cat-${c.handle}`}
                            >
                              {c.name}
                              <ChevronRightIcon className="text-muted" />
                            </button>
                          ) : (
                            <LocalizedClientLink
                              href={`/categories/${c.handle}`}
                              className={row}
                            >
                              {c.name}
                            </LocalizedClientLink>
                          )}
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-6 border-t border-hairline">
                      <li>
                        <LocalizedClientLink href="/custom-order" className={row}>
                          Custom orders
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink href="/account" className={row}>
                          Account
                        </LocalizedClientLink>
                      </li>
                      <li>
                        <LocalizedClientLink href="/contact" className={row}>
                          Contact
                        </LocalizedClientLink>
                      </li>
                    </ul>
                    <div className="space-y-1 px-6 pb-10 pt-8 text-[13px] font-normal leading-5 text-muted">
                      <p className="font-medium text-ink">{storeName}</p>
                      <p>Australia · Prices in AUD incl. GST</p>
                      <p>Shipping Australia-wide</p>
                    </div>
                  </div>

                  {/* Level 2 */}
                  <div
                    className="h-full w-1/2 overflow-y-auto"
                    aria-hidden={!active}
                    inert={!active}
                  >
                    {active && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveId(null)}
                          className="label flex min-h-[52px] w-full items-center gap-x-2 border-b border-hairline px-6 text-ink"
                          data-testid="mobile-back"
                        >
                          <ChevronLeftIcon /> Back
                        </button>
                        <ul>
                          <li>
                            <LocalizedClientLink
                              href={`/categories/${active.handle}`}
                              className={`${subRow} font-medium`}
                            >
                              Shop all {active.name}
                            </LocalizedClientLink>
                          </li>
                          {active.children.map((ch) => (
                            <li key={ch.id}>
                              <LocalizedClientLink
                                href={`/categories/${ch.handle}`}
                                className={subRow}
                              >
                                {ch.name}
                              </LocalizedClientLink>
                            </li>
                          ))}
                        </ul>
                        <span className={groupHead}>Shop by material</span>
                        <ul className="border-t border-hairline">
                          {materials.map((l) => (
                            <li key={l.value}>
                              <LocalizedClientLink
                                href={`/categories/${active.handle}?${attrQuery(l.value)}`}
                                className={subRow}
                              >
                                {l.label}
                              </LocalizedClientLink>
                            </li>
                          ))}
                        </ul>
                        <span className={groupHead}>Shop by colour</span>
                        <ul className="border-t border-hairline pb-10">
                          {colours.map((l) => (
                            <li key={l.value}>
                              <LocalizedClientLink
                                href={`/categories/${active.handle}?${attrQuery(l.value)}`}
                                className={subRow}
                              >
                                {l.label}
                              </LocalizedClientLink>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  )
}
