import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronLeftIcon } from "@modules/layout/components/icons"
import { STORE_NAME } from "@lib/store-name"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative w-full bg-white small:min-h-screen">
      <div className="border-b border-hairline bg-white">
        <nav className="content-container grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center small:h-20">
          <LocalizedClientLink
            href="/cart"
            className="flex items-center gap-x-1 text-[13px] font-light text-muted transition-colors hover:text-ink"
            data-testid="back-to-cart-link"
          >
            <ChevronLeftIcon size={16} />
            <span className="hidden small:inline">Back to bag</span>
            <span className="small:hidden">Bag</span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="whitespace-nowrap font-display text-[19px] font-normal uppercase leading-none tracking-[0.14em] text-ink sm:text-[22px] sm:tracking-[0.2em] small:text-[26px]"
            data-testid="store-link"
          >
            {STORE_NAME}
          </LocalizedClientLink>
          <p className="label flex items-center justify-end gap-x-2 text-muted">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="9" />
              <path d="M8 11V8a4 4 0 018 0v3" />
            </svg>
            <span className="hidden sm:inline">Secure checkout</span>
          </p>
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">
        {children}
      </div>
    </div>
  )
}
