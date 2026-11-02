import { publicCategories, toCategoryFields, toAttrValues, toCategoryIds, type AttrData } from "../../search/helpers/attributes"

const data: AttrData = {
  applicable: { p1: ["a1", "a2", "a3", "a4", "a5"] },
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

describe("toAttrValues only indexes attributes that apply to the current categories", () => {
  it("drops values of an attribute the product's categories no longer carry", () => {
    // p1 moved to a category that only carries a1 and a3: occasion (a2) and width (a4) are stale.
    const moved: AttrData = { ...data, applicable: { p1: ["a1", "a3"] } }
    expect(toAttrValues("p1", moved)).toEqual(["hypoallergenic:false", "material_type:gold_plated"])
  })

  it("indexes nothing when no attribute applies", () => {
    expect(toAttrValues("p1", { ...data, applicable: { p1: [] } })).toEqual([])
    expect(toAttrValues("p1", { ...data, applicable: {} })).toEqual([])
  })
})

describe("publicCategories", () => {
  const cat = (id: string, mpath: string, extra = {}) => ({ id, name: id, mpath, is_active: true, is_internal: false, ...extra })
  const flags = {
    root: { is_active: true, is_internal: false },
    secret: { is_active: true, is_internal: true },
    off: { is_active: false, is_internal: false },
  }

  it("keeps active, public categories", () => {
    expect(publicCategories([cat("root", "root")], flags).map((c) => c.id)).toEqual(["root"])
  })

  it("drops internal and inactive categories", () => {
    const rows = [cat("a", "a"), cat("secret", "secret", { is_internal: true }), cat("off", "off", { is_active: false })]
    expect(publicCategories(rows, flags).map((c) => c.id)).toEqual(["a"])
  })

  it("drops a category that sits under an internal or inactive ancestor", () => {
    const rows = [cat("kid", "secret.kid"), cat("kid2", "off.kid2"), cat("ok", "root.ok")]
    expect(publicCategories(rows, flags).map((c) => c.id)).toEqual(["ok"])
    // and therefore the ancestor ids never reach category_ids
    expect(toCategoryIds(publicCategories([cat("kid", "secret.kid")], flags))).toEqual([])
  })

  it("handles null rows and missing input", () => {
    expect(publicCategories(null)).toEqual([])
    expect(publicCategories([null, undefined])).toEqual([])
  })
})

describe("toCategoryFields (public category names and ids)", () => {
  it("leaves internal and inactive category names and ids out", () => {
    const out = toCategoryFields(
      [
        { id: "pcat_rings", name: "Rings", mpath: "pcat_rings", is_active: true, is_internal: false },
        { id: "pcat_sec", name: "SECRET Internal Clearance", mpath: "pcat_sec", is_active: true, is_internal: true },
        { id: "pcat_off", name: "Inactive Cat", mpath: "pcat_off", is_active: false, is_internal: false },
        { id: "pcat_kid", name: "Kid", mpath: "pcat_sec.pcat_kid", is_active: true, is_internal: false },
      ],
      { pcat_sec: { is_active: true, is_internal: true } },
    )
    expect(out).toEqual({ category: ["Rings"], category_ids: ["pcat_rings"] })
  })
})
