import { Input, Label, Textarea } from "@medusajs/ui"
import type { L10nForm } from "../lib/types"

type L10nInputProps = {
  label: string
  value: L10nForm
  onChange: (value: L10nForm) => void
  /** The text is required unless this is false (an option's title word). */
  requiredEnglish?: boolean
  multiline?: boolean
  maxLength?: number
  placeholder?: string
  disabled?: boolean
  /** Kept so call sites written for a multi-language store still compile; unused. */
  defaultOpen?: boolean
  emptyHint?: string
}

/**
 * One text field. The store is English only, so this is a single "Label"
 * input (the source project showed English plus Sinhala and Tamil inputs).
 */
export const L10nInput = ({
  label,
  value,
  onChange,
  requiredEnglish = true,
  multiline = false,
  maxLength,
  placeholder,
  disabled,
}: L10nInputProps) => {
  const Field = multiline ? Textarea : Input
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <div className="flex flex-col gap-y-1">
      <Label htmlFor={`${id}-en`} size="small" weight="plus">
        {label}
        {requiredEnglish ? " *" : ""}
      </Label>
      <Field
        id={`${id}-en`}
        value={value.en}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, en: event.target.value })}
      />
    </div>
  )
}
