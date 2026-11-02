import { OPTION_HANDLE_RE } from "../../../modules/attributes/lib/validate-definition"
import { uniqueOptionHandle } from "../handle"

describe("uniqueOptionHandle", () => {
  it("makes a valid lower case handle from a label", () => {
    expect(uniqueOptionHandle("Rose Gold (18ct)!", [])).toBe("rose_gold_18ct")
  })

  it("adds a numeric suffix when the handle is taken", () => {
    expect(uniqueOptionHandle("Vermeil", ["vermeil"])).toBe("vermeil_2")
    expect(uniqueOptionHandle("Vermeil", ["vermeil", "vermeil_2"])).toBe("vermeil_3")
  })

  it("falls back to option for labels without usable characters", () => {
    expect(uniqueOptionHandle("???", [])).toBe("option")
  })

  it("keeps long labels within 40 characters, suffix included", () => {
    const label = "a".repeat(80)
    const first = uniqueOptionHandle(label, [])
    const second = uniqueOptionHandle(label, [first])
    expect(first).toHaveLength(40)
    expect(second).not.toBe(first)
    expect(OPTION_HANDLE_RE.test(first)).toBe(true)
    expect(OPTION_HANDLE_RE.test(second)).toBe(true)
  })
})
