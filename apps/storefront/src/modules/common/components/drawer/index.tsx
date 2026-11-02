"use client"

import { Dialog, Transition } from "@headlessui/react"
import { Fragment, useEffect } from "react"

import { clx } from "@modules/common/components/ui"
import { CloseIcon } from "@modules/layout/components/icons"

type DrawerProps = {
  open: boolean
  onClose: () => void
  title: string
  side?: "left" | "right"
  children: React.ReactNode
  /** Rendered under the scrolling body, pinned to the bottom. */
  footer?: React.ReactNode
  "data-testid"?: string
  closeTestId?: string
  /** Keep children mounted while closed (filter widgets must stay registered). */
  keepMounted?: boolean
}

/** Side drawer used for the bag and the listing filters. */
export default function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  "data-testid": testId,
  closeTestId,
  keepMounted = false,
}: DrawerProps) {
  const hidden = side === "right" ? "translate-x-full" : "-translate-x-full"

  useEffect(() => {
    if (!keepMounted || !open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [keepMounted, open, onClose])

  if (keepMounted) {
    // Always rendered (just hidden) so widgets inside stay registered.
    return (
      <div
        className={clx(
          "fixed inset-0 z-[80]",
          open ? "visible" : "invisible pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          className={clx(
            "absolute inset-0 bg-black/40 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={clx(
            "absolute inset-y-0 flex w-[min(92vw,440px)] flex-col bg-white text-ink transition-transform duration-300 ease-out",
            side === "right" ? "right-0" : "left-0",
            open ? "translate-x-0" : hidden
          )}
          data-testid={testId}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline pl-6 pr-3">
            <h2 className="label font-sans">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()}`}
              className="flex h-11 w-11 items-center justify-center"
              data-testid={closeTestId}
            >
              <CloseIcon size={22} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-hairline bg-white px-6 py-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[80]"
        onClose={onClose}
      >
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden />
        </Transition.Child>

        <Transition.Child
          as={Fragment}
          enter="transform transition ease-out duration-300"
          enterFrom={hidden}
          enterTo="translate-x-0"
          leave="transform transition ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo={hidden}
        >
          <Dialog.Panel
            className={clx(
              "fixed inset-y-0 flex w-[min(92vw,440px)] flex-col bg-white text-ink",
              side === "right" ? "right-0" : "left-0"
            )}
            data-testid={testId}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline pl-6 pr-3">
              <Dialog.Title className="label font-sans">{title}</Dialog.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title.toLowerCase()}`}
                className="flex h-11 w-11 items-center justify-center"
                data-testid={closeTestId}
              >
                <CloseIcon size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-hairline bg-white px-6 py-5">
                {footer}
              </div>
            )}
          </Dialog.Panel>
        </Transition.Child>
      </Dialog>
    </Transition>
  )
}
