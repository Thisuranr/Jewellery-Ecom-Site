import { Dialog, Transition } from "@headlessui/react"
import { Button, clx } from "@modules/common/components/ui"
import React, { Fragment, useMemo } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { CloseIcon } from "@modules/layout/components/icons"

import { getProductPrice } from "@lib/util/get-product-price"
import OptionSelect from "./option-select"
import { HttpTypes } from "@medusajs/types"
import { isSimpleProduct } from "@lib/util/product"

type MobileActionsProps = {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  options: Record<string, string | undefined>
  updateOptions: (title: string, value: string) => void
  inStock?: boolean
  handleAddToCart: () => void
  isAdding?: boolean
  show: boolean
  optionsDisabled: boolean
}

/** Sticky bar under 1024px, shown once the main Add to bag button scrolls away. */
const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  options,
  updateOptions,
  inStock,
  handleAddToCart,
  isAdding,
  show,
  optionsDisabled,
}) => {
  const { state, open, close } = useToggleState()

  const price = getProductPrice({ product, variantId: variant?.id })
  const selectedPrice = useMemo(() => {
    if (!price) return null
    return price.variantPrice || price.cheapestPrice || null
  }, [price])

  const isSimple = isSimpleProduct(product)

  return (
    <>
      <div
        className={clx("fixed inset-x-0 bottom-0 z-50 small:hidden", {
          "pointer-events-none": !show,
        })}
      >
        <Transition
          as={Fragment}
          show={show}
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-full"
          enterTo="opacity-100 translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-full"
        >
          <div
            className="flex flex-col gap-y-3 border-t border-hairline bg-white px-4 pb-4 pt-3"
            data-testid="mobile-actions"
          >
            <div className="flex items-baseline justify-between gap-x-3 text-[14px]">
              <span className="truncate font-normal" data-testid="mobile-title">
                {product.title}
              </span>
              {selectedPrice && (
                <span className="shrink-0 font-light">
                  {selectedPrice.calculated_price}
                </span>
              )}
            </div>
            <div
              className={clx("grid grid-cols-2 gap-x-3", {
                "!grid-cols-1": isSimple,
              })}
            >
              {!isSimple && (
                <Button
                  type="button"
                  onClick={open}
                  variant="secondary"
                  size="large"
                  className="w-full !px-3"
                  data-testid="mobile-actions-button"
                >
                  <span className="truncate">
                    {variant
                      ? Object.values(options).join(" / ")
                      : "Select options"}
                  </span>
                </Button>
              )}
              <Button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock || !variant}
                size="large"
                className="w-full !px-3"
                isLoading={isAdding}
                data-testid="mobile-cart-button"
              >
                {!variant
                  ? "Select options"
                  : !inStock
                  ? "Out of stock"
                  : "Add to bag"}
              </Button>
            </div>
          </div>
        </Transition>
      </div>

      <Transition appear show={state} as={Fragment}>
        <Dialog as="div" className="relative z-[75]" onClose={close}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden />
          </Transition.Child>

          <Transition.Child
            as={Fragment}
            enter="transform transition ease-out duration-300"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="transform transition ease-in duration-200"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <Dialog.Panel
              className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-white"
              data-testid="mobile-actions-modal"
            >
              <div className="flex h-14 items-center justify-between border-b border-hairline pl-6 pr-3">
                <Dialog.Title className="label">Select options</Dialog.Title>
                <button
                  onClick={close}
                  className="flex h-11 w-11 items-center justify-center"
                  data-testid="close-modal-button"
                  aria-label="Close"
                >
                  <CloseIcon size={22} />
                </button>
              </div>
              <div className="flex flex-col gap-y-6 px-6 py-8">
                {(product.options || []).map((option) => (
                  <OptionSelect
                    key={option.id}
                    option={option}
                    current={options[option.id]}
                    updateOption={updateOptions}
                    title={option.title ?? ""}
                    name={`mobile-options[${option.id}]`}
                    disabled={optionsDisabled}
                  />
                ))}
                <Button type="button" size="large" onClick={close}>
                  Done
                </Button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  )
}

export default MobileActions
