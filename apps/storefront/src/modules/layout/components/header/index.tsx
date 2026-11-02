"use client"

import type { Navigation } from "@lib/util/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MegaMenu from "../mega-menu"
import MobileMenu from "../mobile-menu"
import { UserIcon } from "../icons"

export default function Header({
  navigation,
  storeName,
  searchSlot,
  cartSlot,
}: {
  navigation: Navigation
  storeName: string
  searchSlot: React.ReactNode
  cartSlot: React.ReactNode
}) {
  const { categories, materials, colours } = navigation

  return (
    <header
      className="relative border-b border-hairline bg-white"
      data-testid="site-header"
    >
      {/* Row 1: menu / wordmark / icons */}
      <div className="content-container grid h-16 grid-cols-[1fr_auto_1fr] items-center small:h-20">
        <div className="flex items-center">
          <div className="small:hidden">
            <MobileMenu
              categories={categories}
              materials={materials}
              colours={colours}
              storeName={storeName}
            />
          </div>
        </div>

        <LocalizedClientLink
          href="/"
          className="whitespace-nowrap font-display text-[19px] font-normal uppercase leading-none tracking-[0.14em] sm:text-[22px] sm:tracking-[0.2em] text-ink small:text-[28px]"
          data-testid="nav-store-link"
        >
          {storeName}
        </LocalizedClientLink>

        <div className="flex items-center justify-end gap-x-1 small:gap-x-6">
          {searchSlot}
          <LocalizedClientLink
            href="/account"
            aria-label="Account"
            className="hidden items-center gap-x-2 text-ink small:flex"
            data-testid="nav-account-link"
          >
            <UserIcon />
            <span className="label hidden medium:inline">Account</span>
          </LocalizedClientLink>
          {cartSlot}
        </div>
      </div>

      {/* Row 2: desktop navigation */}
      <nav
        aria-label="Main"
        className="relative hidden border-t border-hairline small:block"
      >
        <div className="content-container">
          <MegaMenu
            categories={categories}
            materials={materials}
            colours={colours}
          />
        </div>
      </nav>
    </header>
  )
}
