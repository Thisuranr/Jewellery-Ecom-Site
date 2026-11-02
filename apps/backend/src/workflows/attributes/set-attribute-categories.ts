import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  replaceCategoryLinksStep,
  SetAttributeCategoriesInput,
  validateAttributeCategoriesStep,
} from "./steps/category-links"

export type { CategoryLinkInput, SetAttributeCategoriesInput } from "./steps/category-links"

/**
 * Replaces the categories an attribute is linked to. Fails with
 * `category_not_found`. (The source project also asked for a search reindex here; this
 * project has no search-config module, so that event is not emitted.)
 */
export const setAttributeCategoriesWorkflow = createWorkflow(
  "set-attribute-categories",
  (input: SetAttributeCategoriesInput) => {
    validateAttributeCategoriesStep(input)
    const result = replaceCategoryLinksStep(input)
    return new WorkflowResponse(result)
  }
)
