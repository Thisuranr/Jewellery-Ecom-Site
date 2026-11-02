import { model } from "@medusajs/framework/utils"
import AttributeDefinition from "./attribute-definition"

/**
 * A product's value for a text, number or boolean attribute. Select and
 * multiselect values are ProductAttributeOption rows. `variant_id` is unused
 * in M1 (always null). Rows are diffed, not replaced, because `value_text`
 * translations are keyed by the row id (decision 8).
 */
const ProductAttributeValue = model
  .define("product_attribute_value", {
    id: model.id({ prefix: "pattrv" }).primaryKey(),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    attribute: model.belongsTo(() => AttributeDefinition, { mappedBy: "product_values" }),
    value_text: model.text().translatable().nullable(),
    value_number: model.float().nullable(),
    value_bool: model.boolean().nullable(),
  })
  .indexes([
    { on: ["product_id"] },
    { on: ["product_id", "attribute_id"], unique: true, where: "variant_id IS NULL" },
  ])

export default ProductAttributeValue
