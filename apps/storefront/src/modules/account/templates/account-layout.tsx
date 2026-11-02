import React from "react"

import InteractiveLink from "@modules/common/components/interactive-link"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <div className="flex-1" data-testid="account-page">
      <div className="content-container flex h-full max-w-5xl flex-col">
        <div className="grid grid-cols-1 gap-y-8 py-10 small:grid-cols-[220px_1fr] small:gap-x-16 small:py-16">
          <div>{customer && <AccountNav customer={customer} />}</div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        <div className="flex flex-col items-start justify-between gap-6 border-t border-hairline py-10 small:flex-row small:items-center">
          <div>
            <h3 className="font-display text-[26px] leading-tight">
              Got questions?
            </h3>
            <p className="mt-1 text-muted">
              Questions about an order or a custom piece? Get in touch.
            </p>
          </div>
          <InteractiveLink href="/contact">Contact us</InteractiveLink>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
