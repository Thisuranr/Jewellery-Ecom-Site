import { Module } from "@medusajs/framework/utils"
import AttributesModuleService from "./service"

export const ATTRIBUTES_MODULE = "attributes"

export default Module(ATTRIBUTES_MODULE, {
  service: AttributesModuleService,
})
