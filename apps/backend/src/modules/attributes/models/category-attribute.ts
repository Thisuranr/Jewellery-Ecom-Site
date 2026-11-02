import { model } from "@medusajs/framework/utils"
import AttributeDefinition from "./attribute-definition"

/**
 * Links an attribute to a product category. Subcategories inherit it; the
 * nearest link sets `rank` and `required_override` (plan M1, inheritance).
 * `category_id` is a plain id (no module link in M1, decision 5).
 */
const CategoryAttribute = model
  .define("category_attribute", {
    id: model.id({ prefix: "catattr" }).primaryKey(),
    category_id: model.text(),
    attribute: model.belongsTo(() => AttributeDefinition, { mappedBy: "category_links" }),
    rank: model.number().default(0),
    required_override: model.boolean().nullable(),
  })
  .indexes([
    { on: ["category_id", "attribute_id"], unique: true },
    { on: ["category_id"] },
  ])

export default CategoryAttribute
