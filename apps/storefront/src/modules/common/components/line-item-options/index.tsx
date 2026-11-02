import { HttpTypes } from "@medusajs/types"

type LineItemOptionsProps = {
  variant: HttpTypes.StoreProductVariant | undefined
  "data-testid"?: string
  "data-value"?: HttpTypes.StoreProductVariant
}

const LineItemOptions = ({
  variant,
  "data-testid": dataTestid,
  "data-value": dataValue,
}: LineItemOptionsProps) => {
  if (!variant?.title) {
    return null
  }

  return (
    <p
      data-testid={dataTestid}
      data-value={dataValue}
      className="w-full text-[13px] font-light leading-5 text-muted"
    >
      {variant.title}
    </p>
  )
}

export default LineItemOptions
