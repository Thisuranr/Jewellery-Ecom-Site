import { checkDefinitionFields, checkOptionFields } from "../lib/validate-definition"

const code = (message: string | null) => (message ? message.split(":")[0] : null)

describe("checkDefinitionFields", () => {
  const valid = { handle: "length_m", type: "number", unit: "m", label_en: "Length" }

  it("accepts a valid definition", () => {
    expect(checkDefinitionFields(valid, { creating: true })).toBeNull()
  })

  it.each([
    ["L", "uppercase"],
    ["a", "too short"],
    ["1abc", "leading digit"],
    ["fab-ric", "hyphen"],
    ["a".repeat(41), "too long"],
  ])("rejects the handle %s (%s)", (handle) => {
    expect(code(checkDefinitionFields({ ...valid, handle }, { creating: true }))).toBe("invalid_handle")
  })

  it("rejects an unknown type and unit, and a missing or long label", () => {
    expect(code(checkDefinitionFields({ ...valid, type: "date" }, { creating: true }))).toBe("invalid_type")
    expect(code(checkDefinitionFields({ ...valid, unit: "lb" }, { creating: true }))).toBe("invalid_unit")
    expect(code(checkDefinitionFields({ ...valid, label_en: "  " }, { creating: true }))).toBe("label_required")
    expect(code(checkDefinitionFields({ ...valid, label_en: "x".repeat(101) }, { creating: true }))).toBe(
      "label_required"
    )
  })

  it("on update, checks only the fields sent", () => {
    expect(checkDefinitionFields({}, { creating: false })).toBeNull()
    expect(checkDefinitionFields({ unit: null }, { creating: false })).toBeNull()
    expect(code(checkDefinitionFields({ unit: "lb" }, { creating: false }))).toBe("invalid_unit")
    expect(code(checkDefinitionFields({ label_en: null }, { creating: false }))).toBe("label_required")
  })
})

describe("checkOptionFields", () => {
  it("accepts a valid option, with or without a swatch", () => {
    expect(checkOptionFields({ handle: "blue", label_en: "Blue", swatch_hex: "#1565c0" })).toBeNull()
    expect(checkOptionFields({ handle: "intel_i5", label_en: "Intel i5" })).toBeNull()
    expect(checkOptionFields({ handle: "16", label_en: "16" })).toBeNull()
  })

  it("rejects a bad handle, a missing label and a bad swatch", () => {
    expect(code(checkOptionFields({ handle: "_x", label_en: "X" }))).toBe("invalid_option_handle")
    expect(code(checkOptionFields({ handle: "Blue", label_en: "Blue" }))).toBe("invalid_option_handle")
    expect(code(checkOptionFields({ handle: "blue", label_en: "" }))).toBe("label_required")
    expect(code(checkOptionFields({ handle: "blue", label_en: "Blue", swatch_hex: "#1565C0" }))).toBe(
      "invalid_swatch"
    )
    expect(code(checkOptionFields({ handle: "blue", label_en: "Blue", swatch_hex: "blue" }))).toBe(
      "invalid_swatch"
    )
  })
})
