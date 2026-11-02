const Radio = ({
  checked,
  "data-testid": dataTestId,
}: {
  checked: boolean
  "data-testid"?: string
}) => {
  return (
    <span
      role="radio"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-ink bg-white"
      data-testid={dataTestId || "radio-button"}
    >
      {checked && <span className="h-2 w-2 rounded-full bg-ink" />}
    </span>
  )
}

export default Radio
