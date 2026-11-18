import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Preview mode: shown in place of the Checkout buttons and the checkout steps while
 * NEXT_PUBLIC_CHECKOUT_PAUSED=true (src/lib/checkout-paused.ts).
 */
export default function CheckoutPausedNote({
  className = "",
}: {
  className?: string
}) {
  return (
    <div
      className={`flex flex-col gap-y-3 border border-hairline p-4 text-[13px] font-light leading-relaxed ${className}`}
      data-testid="checkout-paused-note"
    >
      <p className="font-normal text-ink">Online payments open soon.</p>
      <p className="text-muted">
        Have something in mind?{" "}
        <LocalizedClientLink
          href="/custom-order"
          className="text-ink underline underline-offset-4"
          data-testid="checkout-paused-contact"
        >
          Contact us
        </LocalizedClientLink>
        .
      </p>
    </div>
  )
}
