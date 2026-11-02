"use client"

import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"

import Item from "@modules/cart/components/item"

const ItemsPreviewTemplate = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const items = cart.items ?? []
  const hasOverflow = items.length > 4

  return (
    <ul
      className={clx("divide-y divide-hairline", {
        "no-scrollbar max-h-[440px] overflow-y-auto": hasOverflow,
      })}
      data-testid="items-table"
    >
      {[...items]
        .sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))
        .map((item) => (
          <li key={item.id} className="py-5 first:pt-0">
            <Item item={item} type="preview" currencyCode={cart.currency_code} />
          </li>
        ))}
    </ul>
  )
}

export default ItemsPreviewTemplate
