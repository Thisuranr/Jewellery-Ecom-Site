import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
}

const Overview = ({ customer, orders }: OverviewProps) => {
  return (
    <div data-testid="overview-page-wrapper">
      <div className="hidden small:block">
        <div className="mb-8 flex items-end justify-between gap-x-6">
          <h1
            className="font-display text-[38px] font-normal leading-tight"
            data-testid="welcome-message"
            data-value={customer?.first_name}
          >
            Hello {customer?.first_name}
          </h1>
          <span className="text-[13px] font-light text-muted">
            Signed in as{" "}
            <span
              className="text-ink"
              data-testid="customer-email"
              data-value={customer?.email}
            >
              {customer?.email}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px border-y border-hairline bg-hairline">
          <div className="bg-white py-6 pr-6">
            <p className="label mb-3 text-muted">Profile</p>
            <div className="flex items-baseline gap-x-2">
              <span
                className="font-display text-[40px] leading-none"
                data-testid="customer-profile-completion"
                data-value={getProfileCompletion(customer)}
              >
                {getProfileCompletion(customer)}%
              </span>
              <span className="text-[13px] font-light text-muted">
                complete
              </span>
            </div>
          </div>
          <div className="bg-white py-6 pl-8">
            <p className="label mb-3 text-muted">Addresses</p>
            <div className="flex items-baseline gap-x-2">
              <span
                className="font-display text-[40px] leading-none"
                data-testid="addresses-count"
                data-value={customer?.addresses?.length || 0}
              >
                {customer?.addresses?.length || 0}
              </span>
              <span className="text-[13px] font-light text-muted">saved</span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-y-5">
          <h2 className="font-display text-[28px] leading-tight">
            Recent orders
          </h2>
          <ul className="flex flex-col" data-testid="orders-wrapper">
            {orders && orders.length > 0 ? (
              orders.slice(0, 5).map((order) => (
                <li
                  key={order.id}
                  data-testid="order-wrapper"
                  data-value={order.id}
                  className="border-b border-hairline first:border-t"
                >
                  <LocalizedClientLink
                    href={`/account/orders/details/${order.id}`}
                    className="flex items-center justify-between gap-x-4 py-4 transition-colors hover:bg-surface"
                  >
                    <div className="grid flex-1 grid-cols-3 gap-x-4 text-[14px]">
                      <span className="label text-muted">Date placed</span>
                      <span className="label text-muted">Order number</span>
                      <span className="label text-muted">Total</span>
                      <span data-testid="order-created-date">
                        {new Date(order.created_at).toDateString()}
                      </span>
                      <span
                        data-testid="order-id"
                        data-value={order.display_id}
                      >
                        #{order.display_id}
                      </span>
                      <span data-testid="order-amount">
                        {convertToLocale({
                          amount: order.total,
                          currency_code: order.currency_code,
                        })}
                      </span>
                    </div>
                    <span data-testid="open-order-button" aria-hidden>
                      &rarr;
                    </span>
                    <span className="sr-only">
                      Go to order #{order.display_id}
                    </span>
                  </LocalizedClientLink>
                </li>
              ))
            ) : (
              <li
                className="border-y border-hairline py-6 text-muted"
                data-testid="no-orders-message"
              >
                No orders yet. Your orders will appear here.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  let count = 0

  if (!customer) {
    return 0
  }

  if (customer.email) {
    count++
  }

  if (customer.first_name && customer.last_name) {
    count++
  }

  if (customer.phone) {
    count++
  }

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  if (billingAddress) {
    count++
  }

  return (count / 4) * 100
}

export default Overview
