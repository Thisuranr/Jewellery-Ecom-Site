"use client"

import clsx from "clsx"
import { useRefinementList } from "react-instantsearch"

type RefinementGroupProps = {
  attribute: string
  title: string
}

const RefinementGroup = ({ attribute, title }: RefinementGroupProps) => {
  const { items, refine } = useRefinementList({
    attribute,
    limit: 20,
    sortBy: ["count:desc", "name:asc"],
  })

  if (!items.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4 py-6">
      <span className="label text-ink">
        {title}
      </span>
      <ul className="flex flex-col gap-y-2 ">
        {items.map((item) => (
          <li key={item.value}>
            <label className="flex cursor-pointer items-start gap-x-2">
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-black"
                data-testid={`refinement-${attribute}`}
              />
              <span
                className={clsx("text-[14px] font-light min-w-0 break-words", {
                  "text-ink": item.isRefined,
                  "text-muted": !item.isRefined,
                })}
              >
                {item.label}
              </span>
              <span className="text-[14px] font-light shrink-0 text-muted">
                ({item.count})
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default RefinementGroup
