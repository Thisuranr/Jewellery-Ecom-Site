import { convertToLocale } from "@lib/util/money"
import { formatDayRange, StorePolicies } from "@lib/util/store-policies"

export const formatShippingRate = (rate: number, currencyCode: string) =>
  rate === 0 ? "Free" : convertToLocale({ amount: rate, currency_code: currencyCode })

export const PolicyPage = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <div className="content-container max-w-3xl py-12 small:py-20" data-testid="policy-page">
    <h1 className="mb-8 font-display text-[38px] font-normal leading-[1.1] small:mb-10 small:text-[52px]">
      {title}
    </h1>
    <div className="flex flex-col gap-6 text-[15px] leading-7 text-ink [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[26px]">
      {children}
    </div>
  </div>
)

export const PoliciesUnavailable = () => (
  <p className="text-muted">
    Policy details for this region haven&apos;t been published yet.
  </p>
)

export const ShippingSummary = ({
  policies,
  currencyCode,
}: {
  policies: StorePolicies
  currencyCode: string
}) => (
  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
    <dt className="text-muted">Shipping rate</dt>
    <dd>{formatShippingRate(policies.shippingRate, currencyCode)}</dd>
    <dt className="text-muted">Processing time</dt>
    <dd>{formatDayRange(policies.handlingDays)} business days</dd>
    <dt className="text-muted">Delivery time</dt>
    <dd>{formatDayRange(policies.transitDays)} business days after dispatch</dd>
  </dl>
)

export const PlaceholderNotice = () => (
  <p className="text-muted" data-testid="policy-placeholder">
    This is placeholder content from the Medusa starter. Replace it with your
    store&apos;s own text before launch.
  </p>
)
