import { Metadata } from "next"

import { STORE_NAME } from "@lib/store-name"
import CustomOrderForm from "@modules/custom-order/components/custom-order-form"

export const metadata: Metadata = {
  title: "Custom orders",
  description: `Have something in mind? Contact ${STORE_NAME} for a custom order.`,
}

export default function CustomOrderPage() {
  return (
    <div className="content-container py-12" data-testid="custom-order-page">
      <h1 className="text-2xl-semi mb-4">Custom orders</h1>
      <p className="text-base-regular text-ui-fg-base max-w-xl mb-8">
        Have something in mind? Tell us about the piece you would like made, and what you would like to spend if you
        have a figure in mind. We will reply by email.
      </p>
      <CustomOrderForm />
    </div>
  )
}
