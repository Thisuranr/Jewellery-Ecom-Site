/**
 * A handle suggested from an English label: lower case, digits and underscores
 * (up to 40 characters). An attribute handle must start with a letter; an
 * option handle may start with a digit.
 */
export function suggestHandle(label: string, kind: "attribute" | "option" = "attribute"): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const trimmed = kind === "attribute" ? base.replace(/^[0-9_]+/, "") : base
  return trimmed.slice(0, 40).replace(/_+$/g, "")
}

/**
 * A new option's handle from its label (lower case, a-z0-9 and underscores,
 * up to 40 characters, as OPTION_HANDLE_RE requires). If `taken` already has
 * it, "_2", "_3"... is added until it is free. Falls back to "option" when the
 * label has no usable characters.
 */
export function uniqueOptionHandle(label: string, taken: readonly string[]): string {
  const base = suggestHandle(label, "option") || "option"
  const used = new Set(taken)
  if (!used.has(base)) {
    return base
  }
  for (let n = 2; ; n++) {
    const suffix = `_${n}`
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/_+$/g, "")}${suffix}`
    if (!used.has(candidate)) {
      return candidate
    }
  }
}
