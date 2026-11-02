"use client"

import { retrieveCart } from "@lib/data/cart"
import { CART_UPDATED_EVENT } from "@lib/util/cart-events"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Item from "@modules/cart/components/item"
import Drawer from "@modules/common/components/drawer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { BagIcon } from "../icons"

const countItems = (cart?: HttpTypes.StoreCart | null) =>
  cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

/** The header Bag: a button that opens the bag in a right-hand drawer. */
const CartDropdown = ({
  cart: serverCart,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  // Statically rendered pages can't read the cart cookie, so the cart is loaded in the browser.
  const [clientCart, setClientCart] = useState<HttpTypes.StoreCart | null>(null)
  const cartState = serverCart ?? clientCart
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const totalItems = countItems(cartState)
  // Items after any discount, GST included (shipping is added at checkout).
  const subtotal = cartState?.item_total ?? 0
  const itemRef = useRef<number>(totalItems || 0)

  useEffect(() => {
    if (serverCart) {
      return
    }

    let isInitialLoad = true
    const load = () =>
      retrieveCart()
        .then((cart) => {
          if (isInitialLoad) {
            // Don't auto-open the drawer for items that were already in the bag.
            itemRef.current = countItems(cart)
            isInitialLoad = false
          }
          setClientCart(cart)
        })
        .catch(() => {})

    load()
    window.addEventListener(CART_UPDATED_EVENT, load)
    return () => window.removeEventListener(CART_UPDATED_EVENT, load)
  }, [serverCart])

  // Open when something is added, but not on the cart page itself.
  useEffect(() => {
    if (totalItems > itemRef.current && !pathname.includes("/cart")) {
      setOpen(true)
    }
    itemRef.current = totalItems
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems])

  // Close when the route changes (a link was followed).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const items = cartState?.items?.length ? cartState.items : null
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-x-2 px-2 text-ink small:px-0"
        aria-label={`Bag, ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
        aria-haspopup="dialog"
        data-testid="nav-cart-link"
      >
        <BagIcon />
        <span className="text-[13px] font-medium tabular-nums" aria-hidden>
          {totalItems}
        </span>
      </button>

      <Drawer
        open={open}
        onClose={close}
        title="Bag"
        data-testid="nav-cart-dropdown"
        footer={
          items && cartState ? (
            <div className="flex flex-col gap-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px]">
                  Subtotal{" "}
                  <span className="text-[13px] text-muted">(incl. GST)</span>
                </span>
                <span
                  className="text-[18px]"
                  data-testid="cart-subtotal"
                  data-value={subtotal}
                >
                  {convertToLocale({
                    amount: subtotal,
                    currency_code: cartState.currency_code,
                  })}
                </span>
              </div>
              <p className="text-[12px] font-light text-muted">
                Shipping is calculated at checkout.
              </p>
              <LocalizedClientLink
                href="/checkout"
                className="btn-solid w-full"
                data-testid="drawer-checkout-button"
              >
                Checkout
              </LocalizedClientLink>
              <LocalizedClientLink
                href="/cart"
                className="btn-outline w-full"
                data-testid="go-to-cart-button"
              >
                View bag
              </LocalizedClientLink>
            </div>
          ) : null
        }
      >
        {items && cartState ? (
          <ul className="divide-y divide-hairline px-6">
            {[...items]
              .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
              .map((item) => (
                <li key={item.id} className="py-6">
                  <Item
                    item={item}
                    type="drawer"
                    currencyCode={cartState.currency_code}
                  />
                </li>
              ))}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-y-5 px-6 py-24 text-center">
            <p className="font-display text-[26px] leading-tight">
              Your bag is empty
            </p>
            <LocalizedClientLink
              href="/store"
              className="btn-outline"
              onClick={close}
            >
              Explore pieces
            </LocalizedClientLink>
          </div>
        )}
      </Drawer>
    </>
  )
}

export default CartDropdown
