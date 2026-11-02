"use client"

import { updateLineItem } from "@lib/data/cart"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { placeholderTypeFromText } from "@modules/common/components/placeholder"
import { clx } from "@modules/common/components/ui"
import Thumbnail from "@modules/products/components/thumbnail"
import { useState } from "react"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  /** full: cart page; drawer: bag drawer; preview: checkout summary (read only). */
  type?: "full" | "preview" | "drawer"
  currencyCode: string
}

const MAX_QUANTITY = 10

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changeQuantity = async (quantity: number) => {
    setError(null)
    setUpdating(true)

    await updateLineItem({ lineId: item.id, quantity })
      .then(notifyCartUpdated)
      .catch((err) => setError(err.message))
      .finally(() => setUpdating(false))
  }

  const href = `/products/${item.product_handle}`

  return (
    <div
      className={clx("grid gap-x-4", {
        "grid-cols-[64px_1fr_auto]": type === "preview",
        "grid-cols-[80px_1fr_auto]": type === "drawer",
        "grid-cols-[88px_1fr_auto] small:grid-cols-[112px_1fr_auto] small:gap-x-6":
          type === "full",
      })}
      data-testid={type === "drawer" ? "cart-item" : "product-row"}
    >
      <LocalizedClientLink href={href} className="block">
        <Thumbnail
          thumbnail={item.thumbnail}
          images={item.variant?.product?.images}
          size="full"
          alt={item.product_title ?? ""}
          placeholderType={placeholderTypeFromText(
            item.product_title,
            item.product_handle,
            item.product_type
          )}
        />
      </LocalizedClientLink>

      <div className="flex min-w-0 flex-col gap-y-1">
        <LocalizedClientLink
          href={href}
          className="text-[15px] font-normal leading-6 text-ink"
          data-testid={type === "drawer" ? "product-link" : "product-title"}
        >
          {item.product_title ?? item.title}
        </LocalizedClientLink>
        <LineItemOptions
          variant={item.variant}
          data-testid={type === "drawer" ? "cart-item-variant" : "product-variant"}
        />
        {type === "preview" ? (
          <p className="text-[13px] font-light text-muted">
            Qty {item.quantity}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div
              className="inline-flex h-9 items-center border border-strong"
              data-testid="product-select-button"
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={updating || item.quantity <= 1}
                onClick={() => changeQuantity(item.quantity - 1)}
                className="h-full w-9 text-[16px] leading-none transition-colors hover:bg-surface disabled:text-muted/40 disabled:hover:bg-transparent"
              >
                −
              </button>
              <span
                className="w-8 text-center text-[14px] tabular-nums"
                data-testid={type === "drawer" ? "cart-item-quantity" : undefined}
                data-value={item.quantity}
                aria-live="polite"
              >
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={updating || item.quantity >= MAX_QUANTITY}
                onClick={() => changeQuantity(item.quantity + 1)}
                className="h-full w-9 text-[16px] leading-none transition-colors hover:bg-surface disabled:text-muted/40 disabled:hover:bg-transparent"
              >
                +
              </button>
            </div>
            <DeleteButton
              id={item.id}
              data-testid={
                type === "drawer"
                  ? "cart-item-remove-button"
                  : "product-delete-button"
              }
            >
              Remove
            </DeleteButton>
          </div>
        )}
        <ErrorMessage error={error} data-testid="product-error-message" />
      </div>

      <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
    </div>
  )
}

export default Item
