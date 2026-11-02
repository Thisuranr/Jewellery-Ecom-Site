import { model } from "@medusajs/framework/utils"
import AttributeDefinition from "./attribute-definition"
import ProductAttributeOption from "./product-attribute-option"

/**
 * One choice of a select or multiselect attribute. `title_label` is the word
 * used in composed product titles when it differs from the filter label
 * (Tamil "நீலம்" in filters, "நீல" in titles); null means use `label`.
 */
const AttributeOption = model
  .define("attribute_option", {
    id: model.id({ prefix: "attropt" }).primaryKey(),
    attribute: model.belongsTo(() => AttributeDefinition, { mappedBy: "options" }),
    // ^[a-z0-9][a-z0-9_]{0,39}$
    handle: model.text(),
    label: model.text().translatable(),
    title_label: model.text().translatable().nullable(),
    rank: model.number().default(0),
    // ^#[0-9a-f]{6}$
    swatch_hex: model.text().nullable(),
    product_options: model.hasMany(() => ProductAttributeOption, { mappedBy: "option" }),
  })
  .indexes([{ on: ["attribute_id", "handle"], unique: true }])

export default AttributeOption
