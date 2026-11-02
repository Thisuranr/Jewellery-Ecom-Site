import { ChevronUpDown } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import {
  SelectHTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

export type NativeSelectProps = {
  placeholder?: string
  /** Label shown above the select. */
  label?: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
} & SelectHTMLAttributes<HTMLSelectElement>

const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    {
      placeholder = "Select...",
      label,
      defaultValue,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLSelectElement>(null)
    const [isPlaceholder, setIsPlaceholder] = useState(false)

    useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
      ref,
      () => innerRef.current
    )

    useEffect(() => {
      if (innerRef.current && innerRef.current.value === "") {
        setIsPlaceholder(true)
      } else {
        setIsPlaceholder(false)
      }
    }, [innerRef.current?.value])

    return (
      <div className="flex w-full flex-col gap-y-1.5">
        {label && (
          <label
            htmlFor={props.id ?? props.name}
            className="text-[12px] font-medium uppercase leading-4 tracking-[0.12em] text-muted"
          >
            {label}
            {props.required && <span aria-hidden> *</span>}
          </label>
        )}
        <div
          onFocus={() => innerRef.current?.focus()}
          onBlur={() => innerRef.current?.blur()}
          className={clx(
            "relative flex items-center text-[15px] font-light border border-strong bg-white hover:border-ink/60 focus-within:border-ink transition-colors",
            className,
            {
              "text-ui-fg-muted": isPlaceholder,
            }
          )}
        >
          <select
            ref={innerRef}
            id={props.id ?? props.name}
            defaultValue={defaultValue}
            {...props}
            className="h-12 w-full appearance-none flex-1 bg-transparent border-none pl-4 pr-10 transition-colors duration-150 outline-none "
          >
            <option disabled value="">
              {placeholder}
            </option>
            {children}
          </select>
          <span className="absolute right-4 inset-y-0 flex items-center pointer-events-none ">
            <ChevronUpDown />
          </span>
        </div>
      </div>
    )
  }
)

NativeSelect.displayName = "NativeSelect"

export default NativeSelect
