import {
  ancestorsFromMpath,
  CategoryLink,
  effectiveForCategories,
} from "../lib/effective-attributes"

const WOMENS = "pcat_womens"
const SAREES = "pcat_sarees"
const SILK_SAREES = "pcat_silk_sarees"
const MENS = "pcat_mens"
const SHIRTS = "pcat_shirts"

const categoriesById = {
  [WOMENS]: { id: WOMENS, mpath: WOMENS },
  [SAREES]: { id: SAREES, mpath: `${WOMENS}.${SAREES}` },
  [SILK_SAREES]: { id: SILK_SAREES, mpath: `${WOMENS}.${SAREES}.${SILK_SAREES}` },
  [MENS]: { id: MENS, mpath: MENS },
  [SHIRTS]: { id: SHIRTS, mpath: `${MENS}.${SHIRTS}` },
}

const definitions = {
  attr_fabric: { id: "attr_fabric", required: true },
  attr_border: { id: "attr_border", required: false },
  attr_care: { id: "attr_care", required: false },
  attr_fit: { id: "attr_fit", required: true },
}

const link = (
  category_id: string,
  attribute_id: string,
  rank = 0,
  required_override: boolean | null = null
): CategoryLink => ({ category_id, attribute_id, rank, required_override })

describe("ancestorsFromMpath", () => {
  it("lists the category itself first, then its parents up to the root", () => {
    expect(ancestorsFromMpath(`${WOMENS}.${SAREES}.${SILK_SAREES}`)).toEqual([
      SILK_SAREES,
      SAREES,
      WOMENS,
    ])
    expect(ancestorsFromMpath(WOMENS)).toEqual([WOMENS])
  })

  it("ignores empty segments and a missing mpath", () => {
    expect(ancestorsFromMpath(`${WOMENS}..${SAREES}.`)).toEqual([SAREES, WOMENS])
    expect(ancestorsFromMpath(null)).toEqual([])
    expect(ancestorsFromMpath("")).toEqual([])
  })
})

describe("effectiveForCategories", () => {
  it("Sarees inherits the Women's workwear link, with that parent as the source", () => {
    const result = effectiveForCategories(
      [SAREES],
      categoriesById,
      [link(WOMENS, "attr_fabric", 2)],
      definitions
    )
    expect(result).toEqual([
      { attribute_id: "attr_fabric", required: true, rank: 2, source_category_id: WOMENS },
    ])
  })

  it("the nearest link wins: its rank and its required_override", () => {
    const links = [
      link(WOMENS, "attr_border", 5, true),
      link(SAREES, "attr_border", 1, false),
      link(WOMENS, "attr_fabric", 0, false),
    ]
    expect(effectiveForCategories([SILK_SAREES], categoriesById, links, definitions)).toEqual([
      { attribute_id: "attr_fabric", required: false, rank: 0, source_category_id: WOMENS },
      { attribute_id: "attr_border", required: false, rank: 1, source_category_id: SAREES },
    ])
  })

  it("a null required_override falls back to the definition", () => {
    const links = [link(SAREES, "attr_fabric", 0, null), link(SAREES, "attr_care", 1, null)]
    const result = effectiveForCategories([SAREES], categoriesById, links, definitions)
    expect(result.map((r) => [r.attribute_id, r.required])).toEqual([
      ["attr_fabric", true],
      ["attr_care", false],
    ])
  })

  it("across two categories: required if either requires it, with the lowest rank", () => {
    const links = [
      link(SAREES, "attr_care", 7, true),
      link(SHIRTS, "attr_care", 3, false),
      link(SHIRTS, "attr_fit", 1),
      link(SAREES, "attr_border", 4),
    ]
    const result = effectiveForCategories([SAREES, SHIRTS], categoriesById, links, definitions)
    expect(result).toEqual([
      { attribute_id: "attr_fit", required: true, rank: 1, source_category_id: SHIRTS },
      { attribute_id: "attr_care", required: true, rank: 3, source_category_id: SHIRTS },
      { attribute_id: "attr_border", required: false, rank: 4, source_category_id: SAREES },
    ])
  })

  it("ignores unknown category ids, unknown attribute ids and unrelated categories", () => {
    const links = [
      link(SAREES, "attr_unknown", 0),
      link(MENS, "attr_fit", 0),
      link(SAREES, "attr_care", 2),
    ]
    expect(
      effectiveForCategories(["pcat_missing", SAREES], categoriesById, links, definitions)
    ).toEqual([
      { attribute_id: "attr_care", required: false, rank: 2, source_category_id: SAREES },
    ])
    expect(effectiveForCategories([], categoriesById, links, definitions)).toEqual([])
  })

  it("does not count a category twice when it is listed twice", () => {
    const links = [link(SAREES, "attr_care", 2)]
    expect(
      effectiveForCategories([SAREES, SAREES], categoriesById, links, definitions)
    ).toHaveLength(1)
  })
})
