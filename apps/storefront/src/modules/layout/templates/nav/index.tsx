import { Suspense } from "react"

import { getNavigation } from "@lib/data/navigation"
import { STORE_NAME } from "@lib/store-name"
import AnnouncementBar from "@modules/layout/components/announcement-bar"
import CartButton from "@modules/layout/components/cart-button"
import Header from "@modules/layout/components/header"
import Search from "@modules/layout/components/search"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BagIcon } from "@modules/layout/components/icons"

export default async function Nav() {
  const navigation = await getNavigation()

  return (
    <>
      <AnnouncementBar />
      <div className="sticky top-0 inset-x-0 z-50">
        <Header
          navigation={navigation}
          storeName={STORE_NAME}
          searchSlot={<Search />}
          cartSlot={
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="flex items-center gap-x-2 text-ink"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  <BagIcon />
                  <span className="text-[13px] font-medium">0</span>
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          }
        />
      </div>
    </>
  )
}
