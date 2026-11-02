import { MedusaService } from "@medusajs/framework/utils"
import AttributeDefinition from "./models/attribute-definition"
import AttributeOption from "./models/attribute-option"
import CategoryAttribute from "./models/category-attribute"
import ProductAttributeOption from "./models/product-attribute-option"
import ProductAttributeValue from "./models/product-attribute-value"

class AttributesModuleService extends MedusaService({
  AttributeDefinition,
  AttributeOption,
  CategoryAttribute,
  ProductAttributeValue,
  ProductAttributeOption,
}) {}

export default AttributesModuleService
