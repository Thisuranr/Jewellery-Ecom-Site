import { facetFor, NUMERIC_FACET_HANDLES, numericFacetField } from "../lib/facets"

describe("numericFacetField", () => {
  it("maps only the five fixed handles to an n_ field", () => {
    expect(NUMERIC_FACET_HANDLES).toHaveLength(5)
    expect(numericFacetField("length_m")).toBe("n_length_m")
    expect(numericFacetField("ram_gb")).toBe("n_ram_gb")
    expect(numericFacetField("storage_gb")).toBe("n_storage_gb")
    expect(numericFacetField("screen_in")).toBe("n_screen_in")
    expect(numericFacetField("warranty_months")).toBe("n_warranty_months")
    expect(numericFacetField("lead_time_days")).toBeNull()
    expect(numericFacetField("length")).toBeNull()
  })
})

describe("facetFor", () => {
  it("filters selects, multiselects and booleans on the attr field with the handle as prefix", () => {
    for (const type of ["select", "multiselect", "boolean"] as const) {
      expect(facetFor("fabric", type)).toEqual({ field: "attr", kind: "value", prefix: "fabric:" })
    }
  })

  it("uses a range field for the fixed numeric handles", () => {
    expect(facetFor("length_m", "number")).toEqual({ field: "n_length_m", kind: "range" })
    expect(facetFor("ram_gb", "number")).toEqual({ field: "n_ram_gb", kind: "range" })
  })

  it("falls back to attr values for another number, and has no facet for text", () => {
    expect(facetFor("lead_time_days", "number")).toEqual({
      field: "attr",
      kind: "value",
      prefix: "lead_time_days:",
    })
    expect(facetFor("care", "text")).toBeNull()
  })

  it("never uses an n_ field for a non-number with a numeric handle", () => {
    expect(facetFor("length_m", "select")).toEqual({ field: "attr", kind: "value", prefix: "length_m:" })
  })
})
