import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  name: string
  disabled: boolean
  "data-testid"?: string
}

/** Square outlined chips; the selected one is filled black. */
const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  name,
  "data-testid": dataTestId,
  disabled,
}) => {
  const values = (option.values ?? []).map((v) => v.value)

  return (
    <fieldset className="flex flex-col gap-y-3" disabled={disabled}>
      <legend className="mb-3 flex items-baseline gap-x-2 text-[12px] font-medium uppercase leading-4 tracking-[0.12em]">
        <span>{title}</span>
        {current && (
          <span className="font-light normal-case tracking-normal text-muted">
            {current}
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2" data-testid={dataTestId}>
        {values.map((v) => {
          const id = `${name}-${v}`.replace(/[^A-Za-z0-9_-]/g, "-")
          return (
            <div key={v}>
              <input
                type="radio"
                id={id}
                name={name}
                value={v}
                checked={v === current}
                onChange={() => updateOption(option.id, v)}
                className="peer sr-only"
              />
              <label
                htmlFor={id}
                className={clx(
                  "flex h-11 min-w-[48px] cursor-pointer items-center justify-center border px-4 text-[14px] font-normal transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                  v === current
                    ? "border-ink bg-ink text-white"
                    : "border-strong bg-white text-ink hover:border-ink"
                )}
                data-testid="option-button"
              >
                {v}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

export default OptionSelect
