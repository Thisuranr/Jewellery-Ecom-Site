import { Module } from "@medusajs/framework/utils"
import configWarningsLoader from "./loaders/config-warnings"
import CustomEnquiryModuleService from "./service"

export const CUSTOM_ENQUIRY_MODULE = "customEnquiry"

export default Module(CUSTOM_ENQUIRY_MODULE, {
  service: CustomEnquiryModuleService,
  loaders: [configWarningsLoader],
})
