import { toAttrValues, toCategoryIds, type AttrData } from "../../search/helpers/attributes"

const data: AttrData = {
  definitions: {
    a1: { id: "a1", handle: "material_type", type: "select", filterable: true },
    a2: { id: "a2", handle: "occasion", type: "multiselect", filterable: true },
    a3: { id: "a3", handle: "hypoallergenic", type: "boolean", filterable: true },
    a4: { id: "a4", handle: "width", type: "number", filterable: true },
    a5: { id: "a5", handle: "base_metal", type: "select", filterable: false },
  },
  options: { o1: "gold_plated", o2: "gift", o3: "everyday", o4: "brass" },
  optionRows: {
    p1: [
      { product_id: "p1", attribute_id: "a1", option_id: "o1" },
      { product_id: "p1", attribute_id: "a2", option_id: "o2" },
      { product_id: "p1", attribute_id: "a2", option_id: "o3" },
      { product_id: "p1", attribute_id: "a5", option_id: "o4" },
      { product_id: "p1", attribute_id: "a1", option_id: "o1" },
    ],
  },
  valueRows: {
    p1: [
      { product_id: "p1", attribute_id: "a3", value_number: null, value_bool: false },
      { product_id: "p1", attribute_id: "a4", value_number: 2.456, value_bool: null },
      { product_id: "p1", attribute_id: "zz", value_number: 1, value_bool: null },
    ],
  },
}

describe("toAttrValues", () => {
  it("builds sorted handle:value keywords for filterable attributes only", () => {
    expect(toAttrValues("p1", data)).toEqual([
      "hypoallergenic:false",
      "material_type:gold_plated",
      "occasion:everyday",
      "occasion:gift",
      "width:2.46",
    ])
  })

  it("returns nothing for a product without values", () => {
    expect(toAttrValues("p2", data)).toEqual([])
  })

  it("ignores an option whose row is unknown", () => {
    const sparse: AttrData = { ...data, options: {} }
    expect(toAttrValues("p1", sparse)).not.toContain("material_type:gold_plated")
  })
})

describe("toCategoryIds", () => {
  it("includes the category and its ancestors once", () => {
    expect(
      toCategoryIds([
        { id: "c", mpath: "a.b.c" },
        { id: "d", mpath: "a.d" },
        null,
      ]),
    ).toEqual(["a", "b", "c", "d"])
  })

  it("copes with missing data", () => {
    expect(toCategoryIds(undefined)).toEqual([])
    expect(toCategoryIds([{ id: "x", mpath: null }])).toEqual(["x"])
  })
})
