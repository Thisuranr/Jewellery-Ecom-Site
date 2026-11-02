import React, { useEffect, useImperativeHandle, useState } from "react"

import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"

type InputProps = Omit<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  "placeholder"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
}

/**
 * The one input style: label above, square field, hairline border that turns
 * black on focus. Replaces the old floating label.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type,
      name,
      label,
      touched: _touched,
      errors: _errors,
      required,
      topLabel: _topLabel,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)
    const inputId = id ?? name

    useEffect(() => {
      if (type === "password") {
        setInputType(showPassword ? "text" : "password")
      } else {
        setInputType(type)
      }
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    return (
      <div className="flex w-full flex-col gap-y-1.5">
        <label
          htmlFor={inputId}
          className="text-[12px] font-medium uppercase leading-4 tracking-[0.12em] text-muted"
        >
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
        <div className="relative flex w-full">
          <input
            id={inputId}
            type={inputType}
            name={name}
            required={required}
            className={`field ${type === "password" ? "pr-11" : ""} ${className ?? ""}`}
            {...props}
            ref={inputRef}
          />
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-muted outline-none transition-colors hover:text-ink focus-visible:text-ink"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input
