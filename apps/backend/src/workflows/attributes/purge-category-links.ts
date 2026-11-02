import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deleteCategoryLinksStep, loadCategoryLinksStep } from "./steps/purge"

export type PurgeCategoryLinksInput = { category_ids: string[] }

/**
 * Hard-deletes the attribute links of the given categories (G2 review finding
 * 1); run by the `product-category.deleted` subscriber. Links carry no
 * translations.
 */
export const purgeCategoryLinksWorkflow = createWorkflow(
  "purge-category-links",
  (input: PurgeCategoryLinksInput) => {
    const links = loadCategoryLinksStep(input)
    const deleted = deleteCategoryLinksStep(links)

    const result = transform({ input, deleted }, ({ input, deleted }) => ({
      category_ids: input.category_ids,
      deleted: deleted.deleted,
    }))
    return new WorkflowResponse(result)
  }
)
