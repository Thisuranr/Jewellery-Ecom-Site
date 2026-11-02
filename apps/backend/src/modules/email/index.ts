import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import EmailNotificationProviderService from "./service"

// Registered in medusa-config.ts under @medusajs/medusa/notification with id
// "email" and channels ["email"] (see src/lib/email-config.ts).
export default ModuleProvider(Modules.NOTIFICATION, {
  services: [EmailNotificationProviderService],
})
