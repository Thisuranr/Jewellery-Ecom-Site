"use client"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const prose = "text-[14px] font-light leading-6 text-muted"

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    ...(product.description
      ? [
          {
            label: "Description",
            component: (
              <p
                className={`${prose} whitespace-pre-line`}
                data-testid="product-description"
              >
                {product.description}
              </p>
            ),
          },
        ]
      : []),
    {
      label: "Shipping & returns",
      component: (
        <div className={`${prose} flex flex-col gap-y-3`}>
          <p>
            We ship Australia-wide. Delivery time and cost are shown at
            checkout before you pay.
          </p>
          <p>
            Changed your mind? Return unworn pieces within 30 days of delivery
            for a refund.
          </p>
        </div>
      ),
    },
    {
      label: "Care",
      component: (
        <p className={prose}>
          Keep your jewellery dry and put it on after perfume, lotion and
          sunscreen. Store each piece separately in a soft pouch, and wipe
          gently with a soft cloth after wearing.
        </p>
      ),
    },
  ]

  return (
    <div className="w-full">
      <Accordion
        type="multiple"
        defaultValue={product.description ? ["Description"] : []}
      >
        {tabs.map((tab) => (
          <Accordion.Item
            key={tab.label}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

export default ProductTabs
