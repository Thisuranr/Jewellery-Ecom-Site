/**
 * The attributes API answers with errors whose message is "<code>: <text>"
 * (plan M1, decision 10), and the js-sdk keeps only the message. This maps the
 * code to wording a shop owner can act on.
 */

const CODE_PATTERN = /^([a-z][a-z0-9_]*): ?([\s\S]*)$/

/** The "<code>" prefix of a message, or null. */
export function errorCode(message: string | null | undefined): string | null {
  return CODE_PATTERN.exec(message ?? "")?.[1] ?? null
}

type Wording = string | ((detail: string) => string)

const WORDING: Record<string, Wording> = {
  handle_taken: "An attribute with this handle already exists. Pick another handle.",
  invalid_handle:
    "The handle must start with a letter and use only lower case letters, digits and underscores (2 to 40 characters).",
  invalid_option_handle:
    "The option handle must use only lower case letters, digits and underscores (up to 40 characters).",
  option_handle_taken: "Another option of this attribute already has this handle.",
  duplicate_option_handle: "Two options have the same handle.",
  invalid_type: "Pick a type for the attribute.",
  invalid_unit: "That unit is not allowed.",
  invalid_swatch: "The colour must look like #1565c0.",
  label_required: "An English label of up to 100 characters is required.",
  options_not_allowed: "Only select and multiselect attributes have options.",
  handle_immutable: "The handle can't be changed after the attribute is created.",
  type_immutable: "The type can't be changed after the attribute is created.",
  attribute_in_use:
    "Products still have values for this attribute. Clear them on the products first.",
  option_in_use: "Products still use this option. Change them on the products first.",
  attribute_not_found: "This attribute no longer exists.",
  option_not_found: "This option no longer exists.",
  category_not_found: "A category no longer exists. Reload the page and try again.",
  duplicate_category: "A category is listed twice.",
  product_not_found: "This product no longer exists.",
  required_missing: (detail) => detail || "Some required attributes have no value.",
  attribute_not_in_category: (detail) =>
    detail || "An attribute is not part of this product's categories.",
  unknown_attribute: "An attribute no longer exists. Reload the page.",
  duplicate_attribute: "An attribute is listed twice.",
  invalid_option: "An option does not belong to its attribute. Reload the page.",
  single_option_required: "This attribute takes one option only.",
  invalid_number:
    "Numbers must be between 0 and 1,000,000 and have at most two decimal places.",
  invalid_boolean: "A yes/no value is not valid.",
  text_too_long: "A text value is longer than 500 characters.",
  value_type_mismatch: "A value does not match the attribute's type. Reload the page.",
  search_keywords_too_long: "The search keywords are longer than 500 characters.",
  invalid_search_keywords: "The search keywords must be text.",
  invalid_query: "The search or page values are not valid.",

  // Quick add saree (plan M1 E2 and E3) and the upload route (C2).
  not_a_saree_category: "That category is not part of Sarees. Pick Sarees or one of its sub-categories.",
  sku_taken:
    "A product with this SKU already exists. If you just submitted this form, the saree may already have been created: check the Products list before adding it again. To add another saree, reload this page or type a different SKU.",
  no_default_location:
    "The store has no default stock location, so the stock can't be added. Open Settings > Store, choose a default location, and submit again. Nothing was created.",
  default_location_not_in_channel:
    "The store's default stock location is not linked to the default sales channel, so the stock could not be sold. Open Settings > Locations & Shipping, add the sales channel to that location, and submit again. Nothing was created.",
  no_default_sales_channel:
    "The store has no default sales channel. Open Settings > Store, choose one, and submit again.",
  no_default_shipping_profile:
    "There is no default shipping profile. Add one under Settings > Locations & Shipping, and submit again.",
  invalid_body: "The form could not be read. Reload the page and try again.",
  invalid_images: "Add 1 to 12 photos, each fully uploaded.",
  invalid_price: "The price must be a whole number of rupees from 1 to 1,000,000.",
  invalid_quantity: "The quantity must be a whole number from 0 to 999.",
  invalid_sku:
    "The SKU may use capital letters, digits and dashes only, 3 to 40 characters.",
  invalid_publish: "Publish must be on or off. Reload the page and try again.",
  invalid_values: "The attribute choices could not be read. Reload the page and try again.",
  invalid_title: "A title is longer than 200 characters.",
  invalid_description: "A description is longer than 2,000 characters.",
  title_values_missing: (detail) =>
    detail || "Choose colour, fabric, drape, length and blouse piece so the title can be composed.",
  invalid_length: "The saree length must be more than 0 metres.",
  label_missing:
    "An attribute option has no English label, so the title can't be composed. Add the label under Settings > Attributes.",
  unsupported_image_type: "Only JPEG, PNG and WebP photos can be uploaded.",
  invalid_image: "That file could not be read as a photo. Try another one.",
  image_too_large_input: "That photo file is too large. Use one under 20 MB.",
  image_too_large: "That photo is still too large after shrinking. Use a smaller photo.",
  upload_too_large: "That photo file is too large. Use one under 20 MB.",
  upload_length_required: "The photo could not be sent. Reload the page and try again.",
}

/** Friendly text for an error thrown by an API call. */
export function describeError(error: unknown, fallback = "Something went wrong. Try again."): string {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : ""
  const match = CODE_PATTERN.exec(message)
  if (match) {
    const wording = WORDING[match[1]]
    if (typeof wording === "function") {
      return wording(match[2].trim())
    }
    if (wording) {
      return wording
    }
    return match[2].trim() || fallback
  }
  return message || fallback
}
