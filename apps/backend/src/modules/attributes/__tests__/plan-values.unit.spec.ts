import type { EffectiveAttribute } from "../lib/effective-attributes"
import {
  AttributeValueInput,
  describeAttributeValueError,
  ExistingOptionRow,
  ExistingValueRow,
  planProductAttributeChanges,
  PlanProductAttributesInput,
} from "../lib/plan-values"

const definitions = {
  attr_drape: { id: "attr_drape", handle: "drape", type: "select" as const },
  attr_fabric: { id: "attr_fabric", handle: "fabric", type: "select" as const },
  attr_occasion: { id: "attr_occasion", handle: "occasion", type: "multiselect" as const },
  attr_length: { id: "attr_length", handle: "length_m", type: "number" as const },
  attr_blouse: { id: "attr_blouse", handle: "blouse_piece", type: "boolean" as const },
  attr_care: { id: "attr_care", handle: "care", type: "text" as const },
  attr_ram: { id: "attr_ram", handle: "ram_gb", type: "number" as const },
}

const optionsById = {
  opt_indian: { id: "opt_indian", attribute_id: "attr_drape" },
  opt_osari: { id: "opt_osari", attribute_id: "attr_drape" },
  opt_cotton: { id: "opt_cotton", attribute_id: "attr_fabric" },
  opt_silk: { id: "opt_silk", attribute_id: "attr_fabric" },
  opt_school: { id: "opt_school", attribute_id: "attr_occasion" },
  opt_office: { id: "opt_office", attribute_id: "attr_occasion" },
  opt_functions: { id: "opt_functions", attribute_id: "attr_occasion" },
}

const eff = (attribute_id: string, required: boolean, rank: number): EffectiveAttribute => ({
  attribute_id,
  required,
  rank,
  source_category_id: "pcat_sarees",
})

// Sarees: everything but ram_gb, which belongs to Laptops.
const effective = [
  eff("attr_drape", true, 0),
  eff("attr_fabric", true, 1),
  eff("attr_occasion", false, 2),
  eff("attr_length", true, 3),
  eff("attr_blouse", true, 4),
  eff("attr_care", false, 5),
]

const fullSet: AttributeValueInput[] = [
  { attribute_id: "attr_drape", option_ids: ["opt_indian"] },
  { attribute_id: "attr_fabric", option_ids: ["opt_cotton"] },
  { attribute_id: "attr_occasion", option_ids: ["opt_school", "opt_office"] },
  { attribute_id: "attr_length", value_number: 6.3 },
  { attribute_id: "attr_blouse", value_bool: true },
  { attribute_id: "attr_care", value_text: { en: "Hand wash", si: "අතින් සෝදන්න", ta: "கையால் கழுவவும்" } },
]

// The rows a first save of fullSet leaves behind.
const savedValues: ExistingValueRow[] = [
  { id: "pattrv_len", attribute_id: "attr_length", value_number: 6.3, value_bool: null, value_text: null },
  { id: "pattrv_bl", attribute_id: "attr_blouse", value_number: null, value_bool: true, value_text: null },
  { id: "pattrv_care", attribute_id: "attr_care", value_number: null, value_bool: null, value_text: "Hand wash" },
]
const savedOptions: ExistingOptionRow[] = [
  { id: "pattro_drape", attribute_id: "attr_drape", option_id: "opt_indian" },
  { id: "pattro_fabric", attribute_id: "attr_fabric", option_id: "opt_cotton" },
  { id: "pattro_school", attribute_id: "attr_occasion", option_id: "opt_school" },
  { id: "pattro_office", attribute_id: "attr_occasion", option_id: "opt_office" },
]

function plan(
  input: AttributeValueInput[],
  existing: Partial<Pick<PlanProductAttributesInput, "existingValues" | "existingOptions">> = {}
) {
  return planProductAttributeChanges({
    effective,
    definitions,
    optionsById,
    existingValues: existing.existingValues ?? [],
    existingOptions: existing.existingOptions ?? [],
    input,
  })
}

const replace = (attribute_id: string, value: Partial<AttributeValueInput>) =>
  fullSet.map((v) => (v.attribute_id === attribute_id ? { attribute_id, ...value } : v))

const errorCodes = (result: ReturnType<typeof plan>) => result.errors.map((e) => e.code)

describe("planProductAttributeChanges: valid input", () => {
  it("a valid full set on a new product plans creates only", () => {
    const result = plan(fullSet)
    expect(result.errors).toEqual([])
    expect(result.createValues).toEqual([
      { attribute_id: "attr_length", value_text: null, value_number: 6.3, value_bool: null },
      { attribute_id: "attr_blouse", value_text: null, value_number: null, value_bool: true },
      { attribute_id: "attr_care", value_text: "Hand wash", value_number: null, value_bool: null },
    ])
    expect(result.createOptions).toEqual([
      { attribute_id: "attr_drape", option_id: "opt_indian" },
      { attribute_id: "attr_fabric", option_id: "opt_cotton" },
      { attribute_id: "attr_occasion", option_id: "opt_school" },
      { attribute_id: "attr_occasion", option_id: "opt_office" },
    ])
    expect(result.updateValues).toEqual([])
    expect(result.deleteValueIds).toEqual([])
    expect(result.deleteOptionIds).toEqual([])
    expect(result.textTranslations).toEqual([
      {
        attribute_id: "attr_care",
        value_id: null,
        values: {
          "si-LK": { value_text: "අතින් සෝදන්න" },
          "ta-LK": { value_text: "கையால் கழுவவும்" },
        },
      },
    ])
  })

  it("resending the same set plans no row changes", () => {
    const result = plan(fullSet, { existingValues: savedValues, existingOptions: savedOptions })
    expect(result.errors).toEqual([])
    expect(result.createValues).toEqual([])
    expect(result.updateValues).toEqual([])
    expect(result.deleteValueIds).toEqual([])
    expect(result.createOptions).toEqual([])
    expect(result.deleteOptionIds).toEqual([])
    // Translations are the desired values, keyed by the existing row;
    // syncTranslationsWorkflow diffs them, so equal values write nothing.
    expect(result.textTranslations).toEqual([
      {
        attribute_id: "attr_care",
        value_id: "pattrv_care",
        values: {
          "si-LK": { value_text: "අතින් සෝදන්න" },
          "ta-LK": { value_text: "கையால் கழுவவும்" },
        },
      },
    ])
  })

  it("dropping one multiselect option plans exactly one delete", () => {
    const result = plan(replace("attr_occasion", { option_ids: ["opt_school"] }), {
      existingValues: savedValues,
      existingOptions: savedOptions,
    })
    expect(result.errors).toEqual([])
    expect(result.deleteOptionIds).toEqual(["pattro_office"])
    expect(result.createOptions).toEqual([])
    expect(result.createValues).toEqual([])
    expect(result.updateValues).toEqual([])
    expect(result.deleteValueIds).toEqual([])
  })

  it("swapping a select option deletes the old row and creates the new one", () => {
    const result = plan(replace("attr_fabric", { option_ids: ["opt_silk"] }), {
      existingValues: savedValues,
      existingOptions: savedOptions,
    })
    expect(result.deleteOptionIds).toEqual(["pattro_fabric"])
    expect(result.createOptions).toEqual([{ attribute_id: "attr_fabric", option_id: "opt_silk" }])
  })

  it("keeps false as a value", () => {
    const result = plan(replace("attr_blouse", { value_bool: false }))
    expect(result.errors).toEqual([])
    expect(result.createValues).toContainEqual({
      attribute_id: "attr_blouse",
      value_text: null,
      value_number: null,
      value_bool: false,
    })

    const update = plan(replace("attr_blouse", { value_bool: false }), {
      existingValues: savedValues,
      existingOptions: savedOptions,
    })
    expect(update.updateValues).toEqual([
      { id: "pattrv_bl", value_text: null, value_number: null, value_bool: false },
    ])
    expect(update.deleteValueIds).toEqual([])
  })

  it("6.3 passes, 0 passes, and a changed number is an update", () => {
    expect(plan(replace("attr_length", { value_number: 0 })).errors).toEqual([])
    const result = plan(replace("attr_length", { value_number: 5.5 }), {
      existingValues: savedValues,
      existingOptions: savedOptions,
    })
    expect(result.updateValues).toEqual([
      { id: "pattrv_len", value_text: null, value_number: 5.5, value_bool: null },
    ])
  })

  it('si: "" plans a translation delete, and a missing ta leaves ta alone', () => {
    const result = plan(replace("attr_care", { value_text: { en: "Hand wash", si: "" } }), {
      existingValues: savedValues,
      existingOptions: savedOptions,
    })
    expect(result.errors).toEqual([])
    expect(result.updateValues).toEqual([])
    expect(result.textTranslations).toEqual([
      { attribute_id: "attr_care", value_id: "pattrv_care", values: { "si-LK": { value_text: null } } },
    ])
  })

  it("an attribute left out is cleared, with its translations", () => {
    const input = fullSet.filter(
      (v) => v.attribute_id !== "attr_care" && v.attribute_id !== "attr_occasion"
    )
    const result = plan(input, { existingValues: savedValues, existingOptions: savedOptions })
    expect(result.errors).toEqual([])
    expect(result.deleteValueIds).toEqual(["pattrv_care"])
    expect(result.deleteOptionIds.sort()).toEqual(["pattro_office", "pattro_school"])
    expect(result.textTranslations).toEqual([
      {
        attribute_id: "attr_care",
        value_id: "pattrv_care",
        values: { "si-LK": { value_text: null }, "ta-LK": { value_text: null } },
      },
    ])
  })

  it("null or empty values clear an optional attribute", () => {
    const result = plan(
      [
        ...fullSet.filter((v) => !["attr_care", "attr_occasion"].includes(v.attribute_id)),
        { attribute_id: "attr_care", value_text: null },
        { attribute_id: "attr_occasion", option_ids: [] },
      ],
      { existingValues: savedValues, existingOptions: savedOptions }
    )
    expect(result.errors).toEqual([])
    expect(result.deleteValueIds).toEqual(["pattrv_care"])
    expect(result.deleteOptionIds.sort()).toEqual(["pattro_office", "pattro_school"])
  })

  it("rows of attributes outside the effective set are cleared on save", () => {
    const result = plan(fullSet, {
      existingValues: [
        ...savedValues,
        { id: "pattrv_ram", attribute_id: "attr_ram", value_number: 16, value_bool: null, value_text: null },
      ],
      existingOptions: savedOptions,
    })
    expect(result.errors).toEqual([])
    expect(result.deleteValueIds).toEqual(["pattrv_ram"])
  })

  it("repeated option ids count once", () => {
    const result = plan(replace("attr_drape", { option_ids: ["opt_indian", "opt_indian"] }))
    expect(result.errors).toEqual([])
    expect(result.createOptions.filter((o) => o.attribute_id === "attr_drape")).toHaveLength(1)
  })
})

describe("planProductAttributeChanges: errors", () => {
  it("unknown_attribute", () => {
    const result = plan([...fullSet, { attribute_id: "attr_nope", value_number: 1 }])
    expect(result.errors).toEqual([{ code: "unknown_attribute", handles: ["attr_nope"] }])
  })

  it("attribute_not_in_category", () => {
    const result = plan([...fullSet, { attribute_id: "attr_ram", value_number: 16 }])
    expect(result.errors).toEqual([{ code: "attribute_not_in_category", handles: ["ram_gb"] }])
  })

  it("duplicate_attribute", () => {
    const result = plan([...fullSet, { attribute_id: "attr_length", value_number: 5 }])
    expect(errorCodes(result)).toEqual(["duplicate_attribute"])
    expect(result.errors[0].handles).toEqual(["length_m"])
  })

  it("invalid_option: an option of another attribute, or an unknown option", () => {
    expect(plan(replace("attr_fabric", { option_ids: ["opt_indian"] })).errors).toEqual([
      { code: "invalid_option", handles: ["fabric"] },
    ])
    expect(errorCodes(plan(replace("attr_occasion", { option_ids: ["opt_school", "opt_x"] })))).toEqual([
      "invalid_option",
    ])
    expect(
      errorCodes(plan(replace("attr_fabric", { option_ids: "opt_cotton" as unknown as string[] })))
    ).toEqual(["invalid_option"])
  })

  it("single_option_required: two options on a select", () => {
    expect(plan(replace("attr_drape", { option_ids: ["opt_indian", "opt_osari"] })).errors).toEqual([
      { code: "single_option_required", handles: ["drape"] },
    ])
  })

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a negative number", -1],
    ["more than 1e6", 1_000_000.01],
    ["more than 2 decimals", 6.333],
    ["a string", "6.3"],
  ])("invalid_number: %s", (_label, value) => {
    expect(plan(replace("attr_length", { value_number: value as number })).errors).toEqual([
      { code: "invalid_number", handles: ["length_m"] },
    ])
  })

  it("1e6 itself is allowed", () => {
    expect(plan(replace("attr_length", { value_number: 1_000_000 })).errors).toEqual([])
  })

  it("invalid_boolean", () => {
    expect(plan(replace("attr_blouse", { value_bool: "true" as unknown as boolean })).errors).toEqual([
      { code: "invalid_boolean", handles: ["blouse_piece"] },
    ])
  })

  it("text_too_long in any language (over 500)", () => {
    expect(errorCodes(plan(replace("attr_care", { value_text: { en: "x".repeat(501) } })))).toEqual([
      "text_too_long",
    ])
    expect(
      errorCodes(plan(replace("attr_care", { value_text: { en: "ok", ta: "x".repeat(501) } })))
    ).toEqual(["text_too_long"])
    expect(plan(replace("attr_care", { value_text: { en: "x".repeat(500) } })).errors).toEqual([])
  })

  it("value_type_mismatch: a value in the wrong field for the type", () => {
    expect(plan(replace("attr_length", { value_bool: true })).errors).toEqual([
      { code: "value_type_mismatch", handles: ["length_m"] },
    ])
    expect(
      errorCodes(plan(replace("attr_fabric", { option_ids: ["opt_cotton"], value_text: { en: "x" } })))
    ).toEqual(["value_type_mismatch"])
  })

  it("required_missing lists every missing handle", () => {
    const input = fullSet.filter((v) =>
      ["attr_drape", "attr_occasion", "attr_care"].includes(v.attribute_id)
    )
    const result = plan([...input, { attribute_id: "attr_blouse", value_bool: null }])
    expect(result.errors).toEqual([
      { code: "required_missing", handles: ["fabric", "length_m", "blouse_piece"] },
    ])
  })

  it("errors plan no changes, and list each failing handle under its code", () => {
    const result = plan([
      ...fullSet.filter((v) => !["attr_length", "attr_fabric"].includes(v.attribute_id)),
      { attribute_id: "attr_length", value_number: -5 },
      { attribute_id: "attr_fabric", option_ids: ["opt_school"] },
      { attribute_id: "attr_ram", value_number: 8 },
    ])
    expect(result.errors).toEqual([
      { code: "invalid_number", handles: ["length_m"] },
      { code: "invalid_option", handles: ["fabric"] },
      { code: "attribute_not_in_category", handles: ["ram_gb"] },
    ])
    expect(result.createValues).toEqual([])
    expect(result.createOptions).toEqual([])
    expect(result.textTranslations).toEqual([])
  })
})

describe("planProductAttributeChanges: labels in error messages", () => {
  const labelled = {
    attr_drape: { ...definitions.attr_drape, label: "Drape" },
    attr_fabric: { ...definitions.attr_fabric, label: "Fabric" },
    attr_occasion: { ...definitions.attr_occasion, label: "Occasion" },
    attr_length: { ...definitions.attr_length, label: "Length" },
    attr_blouse: { ...definitions.attr_blouse, label: "  " },
    attr_care: { ...definitions.attr_care },
    attr_ram: { ...definitions.attr_ram, label: "Memory (RAM)" },
  }
  const planLabelled = (input: AttributeValueInput[]) =>
    planProductAttributeChanges({
      effective,
      definitions: labelled,
      optionsById,
      existingValues: [],
      existingOptions: [],
      input,
    })

  it("required_missing keeps the code and handles and adds the labels", () => {
    const input = fullSet.filter((v) => ["attr_drape", "attr_occasion", "attr_care"].includes(v.attribute_id))
    const result = planLabelled(input)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe("required_missing")
    expect(result.errors[0].handles).toEqual(["fabric", "length_m", "blouse_piece"])
    // A blank label is not used: that attribute falls back to its handle.
    expect(result.errors[0].labels).toEqual({ fabric: "Fabric", length_m: "Length" })
  })

  it("the message names the label, and the handle when there is no label", () => {
    const input = fullSet.filter((v) => ["attr_drape", "attr_occasion", "attr_care"].includes(v.attribute_id))
    const [error] = planLabelled(input).errors
    expect(describeAttributeValueError(error)).toBe("Required attributes missing: Fabric, Length, blouse_piece")
  })

  it("other codes use the label too", () => {
    const [error] = planLabelled(replace("attr_length", { value_number: -1 })).errors
    expect(error.code).toBe("invalid_number")
    expect(describeAttributeValueError(error)).toMatch(/: Length$/)
    const [outside] = planLabelled([...fullSet, { attribute_id: "attr_ram", value_number: 16 }]).errors
    expect(describeAttributeValueError(outside)).toBe(
      "Attribute does not apply to the product's categories: Memory (RAM)"
    )
  })

  it("without labels the message names the handles, as before", () => {
    const input = fullSet.filter((v) => ["attr_drape", "attr_occasion", "attr_care"].includes(v.attribute_id))
    const [error] = plan(input).errors
    expect(error.labels).toBeUndefined()
    expect(describeAttributeValueError(error)).toBe(
      "Required attributes missing: fabric, length_m, blouse_piece"
    )
  })

  it("an unknown attribute id is shown as the id", () => {
    const [error] = planLabelled([...fullSet, { attribute_id: "attr_nope", value_number: 1 }]).errors
    expect(describeAttributeValueError(error)).toBe("Unknown attribute: attr_nope")
  })
})
