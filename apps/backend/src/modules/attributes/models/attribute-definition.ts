import { model } from "@medusajs/framework/utils"
import AttributeOption from "./attribute-option"
import CategoryAttribute from "./category-attribute"
import ProductAttributeOption from "./product-attribute-option"
import ProductAttributeValue from "./product-attribute-value"

export const ATTRIBUTE_TYPES = [
  "text",
  "number",
  "boolean",
  "select",
  "multiselect",
] as const

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number]

/**
 * A product attribute such as fabric or length (spec 4.2). `handle` and `type`
 * never change after creation (the workflows refuse it). Validation of
 * handle, unit and the rest is in the workflows and API schemas.
 */
const AttributeDefinition = model
  .define("attribute_definition", {
    id: model.id({ prefix: "attr" }).primaryKey(),
    // ^[a-z][a-z0-9_]{1,39}$
    handle: model.text(),
    label: model.text().translatable(),
    type: model.enum([...ATTRIBUTE_TYPES]),
    // m, cm, GB, kg, in, months, days (checked by the API schema)
    unit: model.text().nullable(),
    group_handle: model.text().nullable(),
    filterable: model.boolean().default(false),
    required: model.boolean().default(false),
    rank: model.number().default(0),
    options: model.hasMany(() => AttributeOption, { mappedBy: "attribute" }),
    category_links: model.hasMany(() => CategoryAttribute, { mappedBy: "attribute" }),
    product_values: model.hasMany(() => ProductAttributeValue, { mappedBy: "attribute" }),
    product_options: model.hasMany(() => ProductAttributeOption, { mappedBy: "attribute" }),
  })
  .indexes([{ on: ["handle"], unique: true }])

export default AttributeDefinition
