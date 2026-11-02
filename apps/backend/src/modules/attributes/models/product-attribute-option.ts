import { model } from "@medusajs/framework/utils"
import AttributeDefinition from "./attribute-definition"
import AttributeOption from "./attribute-option"

/**
 * A product's chosen option of a select or multiselect attribute (one row per
 * option). `variant_id` is unused in M1 (always null).
 */
const ProductAttributeOption = model
  .define("product_attribute_option", {
    id: model.id({ prefix: "pattro" }).primaryKey(),
    product_id: model.text(),
    variant_id: model.text().nullable(),
    attribute: model.belongsTo(() => AttributeDefinition, { mappedBy: "product_options" }),
    option: model.belongsTo(() => AttributeOption, { mappedBy: "product_options" }),
  })
  .indexes([
    { on: ["product_id"] },
    { on: ["attribute_id", "option_id"] },
    { on: ["product_id", "option_id"], unique: true, where: "variant_id IS NULL" },
  ])

export default ProductAttributeOption
