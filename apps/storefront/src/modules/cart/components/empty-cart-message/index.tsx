import LocalizedClientLink from "@modules/common/components/localized-client-link"

const EmptyCartMessage = () => {
  return (
    <div
      className="flex flex-col items-center px-2 py-24 text-center small:py-36"
      data-testid="empty-cart-message"
    >
      <h1 className="font-display text-[34px] font-normal leading-tight small:text-[44px]">
        Your bag is empty
      </h1>
      <p className="mb-8 mt-4 max-w-[30rem] text-muted">
        Nothing here yet. Browse the collection and add a piece you love.
      </p>
      <LocalizedClientLink href="/store" className="btn-solid">
        Explore pieces
      </LocalizedClientLink>
    </div>
  )
}

export default EmptyCartMessage
