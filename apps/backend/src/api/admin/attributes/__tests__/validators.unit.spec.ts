import {
  AdminCreateAttributeSchema,
  AdminOptionInputSchema,
  AdminSetAttributeCategoriesSchema,
  AdminSetProductAttributesSchema,
  AdminUpdateAttributeSchema,
  parseListQuery,
} from "../validators"

describe("AdminCreateAttributeSchema", () => {
  const valid = { handle: "fabric", type: "select", label: { en: "Material type" } }

  it("accepts a select attribute with options and trims the label", () => {
    const parsed = AdminCreateAttributeSchema.parse({
      ...valid,
      label: { en: "  Fabric  " },
      options: [{ handle: "cotton", label: { en: "Cotton" }, title_label: { en: "Cotton" } }],
    })
    expect(parsed.label.en).toBe("Fabric")
    expect(parsed.options).toHaveLength(1)
  })

  it("requires an English label and a known type, and refuses unknown keys", () => {
    expect(AdminCreateAttributeSchema.safeParse({ ...valid, label: { si: "x" } }).success).toBe(false)
    expect(AdminCreateAttributeSchema.safeParse({ ...valid, label: { en: " " } }).success).toBe(false)
    expect(AdminCreateAttributeSchema.safeParse({ ...valid, type: "date" }).success).toBe(false)
    expect(AdminCreateAttributeSchema.safeParse({ ...valid, bogus: 1 }).success).toBe(false)
  })

  it("leaves the handle pattern to the workflow, which answers with a coded error", () => {
    expect(AdminCreateAttributeSchema.safeParse({ ...valid, handle: "Bad-Handle" }).success).toBe(true)
  })
})

describe("AdminUpdateAttributeSchema", () => {
  it("passes handle and type through so the workflow can refuse them", () => {
    const parsed = AdminUpdateAttributeSchema.parse({ type: "text", handle: "x", rank: 2 })
    expect(parsed.type).toBe("text")
    expect(parsed.handle).toBe("x")
  })

  it("is partial and strict", () => {
    expect(AdminUpdateAttributeSchema.safeParse({}).success).toBe(true)
    expect(AdminUpdateAttributeSchema.safeParse({ filterable: "yes" }).success).toBe(false)
    expect(AdminUpdateAttributeSchema.safeParse({ options: [] }).success).toBe(false)
  })
})

describe("option, category and value schemas", () => {
  it("needs a handle and an English label for an option", () => {
    expect(AdminOptionInputSchema.safeParse({ handle: "silk", label: { en: "Silk" } }).success).toBe(true)
    expect(AdminOptionInputSchema.safeParse({ label: { en: "Silk" } }).success).toBe(false)
    expect(AdminOptionInputSchema.safeParse({ handle: "silk", label: { en: "" } }).success).toBe(false)
  })

  it("takes a list of category links", () => {
    expect(
      AdminSetAttributeCategoriesSchema.safeParse({
        categories: [{ category_id: "pcat_1", rank: 2, required_override: null }],
      }).success
    ).toBe(true)
    expect(AdminSetAttributeCategoriesSchema.safeParse({ categories: [{ rank: 1 }] }).success).toBe(false)
    expect(AdminSetAttributeCategoriesSchema.safeParse({}).success).toBe(false)
  })

  it("checks the type of each product value, and leaves the ranges to the planner", () => {
    const ok = AdminSetProductAttributesSchema.safeParse({
      values: [
        { attribute_id: "attr_1", option_ids: ["attropt_1"] },
        { attribute_id: "attr_2", value_number: -4 },
        { attribute_id: "attr_3", value_bool: false },
        { attribute_id: "attr_4", value_text: { en: "Hand wash" } },
      ],
      search_keywords: "sari",
    })
    expect(ok.success).toBe(true)
    for (const bad of [
      { attribute_id: "attr_2", value_number: "6" },
      { attribute_id: "attr_3", value_bool: "false" },
      { attribute_id: "attr_1", option_ids: "attropt_1" },
      { attribute_id: "attr_4", value_text: "Hand wash" },
      { value_number: 1 },
    ]) {
      expect(AdminSetProductAttributesSchema.safeParse({ values: [bad] }).success).toBe(false)
    }
    expect(AdminSetProductAttributesSchema.safeParse({}).success).toBe(false)
  })
})

describe("parseListQuery", () => {
  it("defaults to 50 from 0", () => {
    expect(parseListQuery({})).toEqual({ q: undefined, limit: 50, offset: 0 })
  })

  it("reads strings from the query string and trims q", () => {
    expect(parseListQuery({ q: "  fab ", limit: "10", offset: "20" })).toEqual({
      q: "fab",
      limit: 10,
      offset: 20,
    })
  })

  it("refuses a limit outside 1..200 and a negative offset, with the code invalid_query", () => {
    for (const query of [{ limit: "0" }, { limit: "201" }, { offset: "-1" }, { limit: "abc" }]) {
      expect(() => parseListQuery(query)).toThrow(/^invalid_query: /)
    }
  })
})

describe("English only", () => {
  it("rejects Sinhala and Tamil text", () => {
    const schema = AdminCreateAttributeSchema
    expect(
      schema.safeParse({ handle: "metal", type: "text", label: { en: "Metal", si: "x" } }).success
    ).toBe(false)
  })
})

describe("control characters (NUL makes Postgres fail with a 500)", () => {
  const nul = "bad\u0000value"
  it("rejects them in labels, handles, option labels, text values and search keywords", () => {
    expect(AdminCreateAttributeSchema.safeParse({ handle: "fabric", type: "select", label: { en: nul } }).success).toBe(false)
    expect(AdminCreateAttributeSchema.safeParse({ handle: nul, type: "select", label: { en: "x" } }).success).toBe(false)
    expect(
      AdminCreateAttributeSchema.safeParse({
        handle: "fabric",
        type: "select",
        label: { en: "x" },
        options: [{ handle: "a", label: { en: nul } }],
      }).success
    ).toBe(false)
    expect(
      AdminSetProductAttributesSchema.safeParse({ values: [{ attribute_id: "a", value_text: { en: nul } }] }).success
    ).toBe(false)
    expect(AdminSetProductAttributesSchema.safeParse({ values: [], search_keywords: nul }).success).toBe(false)
    expect(parseListQueryThrows({ q: nul })).toBe(true)
  })

  it("still accepts normal text with a line break or tab", () => {
    expect(AdminSetProductAttributesSchema.safeParse({ values: [], search_keywords: "a\tb\nc" }).success).toBe(true)
    expect(AdminCreateAttributeSchema.safeParse({ handle: "fabric", type: "select", label: { en: "Gold" } }).success).toBe(true)
  })
})

function parseListQueryThrows(q: Record<string, unknown>): boolean {
  try {
    parseListQuery(q)
    return false
  } catch {
    return true
  }
}
