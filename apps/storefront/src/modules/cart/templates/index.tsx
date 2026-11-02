import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import { HttpTypes } from "@medusajs/types"

const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  return (
    <div className="py-10 small:py-16">
      <div className="content-container" data-testid="cart-container">
        {cart?.items?.length ? (
          <>
            <h1 className="mb-8 font-display text-[34px] font-normal leading-tight small:mb-12 small:text-[48px]">
              Your bag
            </h1>
            <div className="grid grid-cols-1 gap-y-10 small:grid-cols-[1fr_380px] small:gap-x-20 medium:gap-x-28">
              <div className="flex flex-col gap-y-6">
                {!customer && <SignInPrompt />}
                <ItemsTemplate cart={cart} />
              </div>
              <div className="relative">
                <div className="sticky top-40 bg-surface p-6 small:p-8">
                  {cart.region && <Summary cart={cart} />}
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyCartMessage />
        )}
      </div>
    </div>
  )
}

export default CartTemplate
