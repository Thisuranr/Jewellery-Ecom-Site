import type { LoaderOptions } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { configWarnings } from "../../../lib/config-warnings"

/**
 * Runs once at boot (a module loader, so medusa-config.ts stays untouched). Logs a warning for each
 * placeholder setting that would break the store in production. Never throws.
 */
export default async function configWarningsLoader({ container }: LoaderOptions): Promise<void> {
  try {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as { warn: (m: string) => void }
    for (const message of configWarnings()) {
      logger.warn(message)
    }
  } catch {
    // A logging problem must never stop the backend from starting.
  }
}
