import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Rebuilds the product search index from the database:
 * `pnpm exec medusa exec ./src/scripts/reindex-search.ts`.
 * Needed only for a manual catch-up; the index follows product and attribute
 * events by itself, and the Search Module rebuilds it on boot when the index
 * schema changes.
 */
export default async function reindexSearch({ container }: ExecArgs) {
  const search = container.resolve(Modules.SEARCH)
  const { job_id } = await search.reindex({ index: "product" })
  console.log(`Reindex of "product" finished (job ${job_id})`)
}
