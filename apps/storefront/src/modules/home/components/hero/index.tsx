import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Placeholder from "@modules/common/components/placeholder"
import { NEWEST_QUERY } from "@lib/util/navigation"

const Hero = () => {
  return (
    <section
      className="border-b border-hairline bg-surface"
      data-testid="home-hero"
    >
      <div className="mx-auto grid max-w-[1680px] small:min-h-[min(80vh,760px)] small:grid-cols-2">
        <div className="relative order-2 flex flex-col justify-center px-4 py-16 sm:px-8 small:order-1 small:px-16 small:py-24 medium:px-24">
          <h1 className="font-display text-[40px] font-normal italic leading-[1.05] tracking-[-0.01em] text-ink small:text-[72px]">
            Fine jewellery, made to be worn
          </h1>
          <p className="mt-6 max-w-md text-[15px] font-light leading-[1.65] text-muted small:text-[16px]">
            Rings, earrings, necklaces and bracelets in gold plated, sterling
            silver and solid gold. Ready to wear, or made to order for you.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <LocalizedClientLink
              href={`/store?${NEWEST_QUERY}`}
              className="btn-solid"
            >
              Shop new in
            </LocalizedClientLink>
            <LocalizedClientLink href="/custom-order" className="btn-outline">
              Custom orders
            </LocalizedClientLink>
          </div>
        </div>
        <div className="relative order-1 aspect-[4/3] small:order-2 small:aspect-auto">
          <Placeholder type="generic" tone="mid" fill />
        </div>
      </div>
    </section>
  )
}

export default Hero
