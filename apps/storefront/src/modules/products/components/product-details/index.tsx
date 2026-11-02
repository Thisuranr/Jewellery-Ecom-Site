import {
  ProductAttribute,
  retrieveProductAttributes,
} from "@lib/data/product-attributes"

const GROUP_ORDER = ["metal", "stones", "fit", "details"]
const GROUP_LABELS: Record<string, string> = {
  metal: "Metal",
  stones: "Stones",
  fit: "Fit",
  details: "Details",
}

const titleCase = (handle: string) =>
  handle.charAt(0).toUpperCase() + handle.slice(1).replace(/_/g, " ")

/** A value as plain text: "Gold plated", "2.4 g", "Yes", "Round, Oval". */
export function formatAttributeValue(attribute: ProductAttribute): string {
  const { value, unit } = attribute

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (Array.isArray(value)) {
    return value.map((option) => option.label).join(", ")
  }

  return unit && typeof value === "number" ? `${value} ${unit}` : String(value)
}

/** Plain list of a product's attributes by group; empty groups are hidden. */
const ProductDetails = async ({ productId }: { productId: string }) => {
  const groups = (await retrieveProductAttributes(productId))
    .map((group) => ({
      ...group,
      attributes: group.attributes.filter(
        (attribute) => formatAttributeValue(attribute).trim() !== ""
      ),
    }))
    .filter((group) => group.attributes.length > 0)
    .sort((a, b) => {
      const rank = (handle: string) =>
        GROUP_ORDER.includes(handle) ? GROUP_ORDER.indexOf(handle) : 99
      return rank(a.handle) - rank(b.handle)
    })

  if (!groups.length) {
    return null
  }

  return (
    <section data-testid="product-details" className="flex flex-col gap-y-4">
      <h2 className="text-base-semi">Details</h2>
      {groups.map((group) => (
        <div key={group.handle} data-testid={`product-details-${group.handle}`}>
          <h3 className="text-small-semi text-ui-fg-base mb-1">
            {GROUP_LABELS[group.handle] ?? titleCase(group.handle)}
          </h3>
          <ul className="text-small-regular text-ui-fg-subtle flex flex-col gap-y-1">
            {group.attributes.map((attribute) => (
              <li key={attribute.handle}>
                {attribute.label}: {formatAttributeValue(attribute)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default ProductDetails
