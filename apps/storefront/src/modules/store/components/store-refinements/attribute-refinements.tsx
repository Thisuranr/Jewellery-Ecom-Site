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
    <div className="flex flex-col divide-y divide-hairline" data-testid="attribute-refinements">
      {groups.map(({ attribute, options }) => (
        <div
          key={attribute.handle}
          className="flex flex-col gap-y-4 py-6"
          data-testid={`attribute-refinement-${attribute.handle}`}
        >
          <span className="label text-ink">
            {attribute.label}
          </span>
          <ul className="flex flex-col gap-y-2 ">
            {options.map(({ option, item }) => (
              <li key={option.value}>
                <label className="flex cursor-pointer items-start gap-x-2">
                  <input
                    type="checkbox"
                    checked={item!.isRefined}
                    onChange={() => refine(option.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-black"
                    data-testid={`attribute-option-${option.value}`}
                  />
                  <span
                    className={clsx("text-[14px] font-light min-w-0 break-words", {
                      "text-ink": item!.isRefined,
                      "text-muted": !item!.isRefined,
                    })}
                  >
                    {option.label}
                  </span>
                  <span className="text-[14px] font-light shrink-0 text-muted">
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
