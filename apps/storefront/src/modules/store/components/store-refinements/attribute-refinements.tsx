"use client"

import clsx from "clsx"
import { useRefinementList } from "react-instantsearch"

import { ATTR_FIELD, type FilterAttribute } from "@lib/util/filter-attributes"

const FACET_LIMIT = 500

/**
 * One plain group per filterable attribute (material, purity, ...). They all
 * read the index's `attr` field, whose values look like
 * "material_type:gold_plated"; counts come from the current results, so an
 * option no product in them has is not offered (a selected one stays).
 * Selecting options of several attributes narrows the results (AND).
 */
const AttributeRefinements = ({
  attributes,
}: {
  attributes: FilterAttribute[]
}) => {
  const { items, refine } = useRefinementList({
    attribute: ATTR_FIELD,
    limit: FACET_LIMIT,
    operator: "and",
  })
  const byValue = new Map(items.map((item) => [item.value, item]))

  const groups = attributes
    .map((attribute) => ({
      attribute,
      options: attribute.options
        .map((option) => ({ option, item: byValue.get(option.value) }))
        .filter(({ item }) => item && (item.count > 0 || item.isRefined)),
    }))
    .filter((group) => group.options.length > 0)

  if (!groups.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-6" data-testid="attribute-refinements">
      {groups.map(({ attribute, options }) => (
        <div
          key={attribute.handle}
          className="flex flex-col gap-y-3"
          data-testid={`attribute-refinement-${attribute.handle}`}
        >
          <span className="txt-compact-small-plus text-ui-fg-subtle">
            {attribute.label}
          </span>
          <ul className="flex flex-col gap-y-2 pr-6">
            {options.map(({ option, item }) => (
              <li key={option.value}>
                <label className="flex cursor-pointer items-start gap-x-2">
                  <input
                    type="checkbox"
                    checked={item!.isRefined}
                    onChange={() => refine(option.value)}
                    className="mt-1 shrink-0 accent-ui-fg-interactive"
                    data-testid={`attribute-option-${option.value}`}
                  />
                  <span
                    className={clsx("text-small-regular min-w-0 break-words", {
                      "text-ui-fg-base": item!.isRefined,
                      "text-ui-fg-subtle": !item!.isRefined,
                    })}
                  >
                    {option.label}
                  </span>
                  <span className="text-small-regular shrink-0 text-ui-fg-muted">
                    ({item!.count})
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export default AttributeRefinements
