import { Metadata } from "next"

import { listProducts } from "@lib/data/products"
import { STORE_NAME } from "@lib/store-name"
import CustomOrderForm from "@modules/custom-order/components/custom-order-form"

export const metadata: Metadata = {
  title: "Custom orders",
  description: `Have something in mind? Contact ${STORE_NAME} for a custom order.`,
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ product?: string | string[] }>
}

export default async function CustomOrderPage(props: Props) {
  const { countryCode } = await props.params
  const raw = (await props.searchParams).product
  const handle = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 120)

  // A reference to the piece the visitor came from, when there is one.
  let reference: string | undefined
  if (handle && /^[a-z0-9-]+$/i.test(handle)) {
    const title = await listProducts({
      countryCode,
      queryParams: { handle, limit: 1 },
    })
      .then(({ response }) => response.products[0]?.title)
      .catch(() => undefined)
    reference = `I'd like to enquire about customising "${title ?? handle}" (product: ${handle}).\n\n`
  }

  return (
    <div
      className="content-container py-12 small:py-20"
      data-testid="custom-order-page"
    >
      <div className="grid grid-cols-1 gap-x-24 gap-y-10 small:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div>
          <p className="label mb-4 text-muted">Made to order</p>
          <h1 className="font-display text-[38px] font-normal leading-[1.1] small:text-[52px]">
            Custom orders
          </h1>
          <p className="mt-5 max-w-md text-muted">
            Have something in mind? Tell us about the piece you would like
            made, and what you would like to spend if you have a figure in
            mind. We will reply by email.
          </p>
        </div>
        <CustomOrderForm initialMessage={reference} />
      </div>
    </div>
  )
}
