import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function CustomOrderBand() {
  return (
    <section className="border-y border-hairline bg-surface">
      <div className="content-container flex flex-col items-center gap-y-8 py-16 text-center small:flex-row small:justify-between small:py-20 small:text-left">
        <div>
          <h2 className="section-title">Something of your own?</h2>
          <p className="mt-3 text-[15px] text-muted">
            Tell us what you have in mind and we will make it to order.
          </p>
        </div>
        <LocalizedClientLink href="/custom-order" className="btn-solid shrink-0">
          Start a custom order
        </LocalizedClientLink>
      </div>
    </section>
  )
}
