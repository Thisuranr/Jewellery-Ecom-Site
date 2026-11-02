import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Prints the storefront's publishable API key between markers, for
 * scripts/local-setup.mjs. Run: pnpm exec medusa exec ./src/scripts/print-publishable-key.ts
 */
export default async function printPublishableKey({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["token", "revoked_at", "created_at"],
    filters: { type: "publishable" },
  })
  const key = data
    .filter((k) => !k.revoked_at)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0]
  console.log(`PUBLISHABLE_KEY=${key?.token ?? ""}=END`)
}
