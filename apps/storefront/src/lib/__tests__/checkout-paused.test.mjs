// Run with `pnpm --filter @dtc/storefront test` (node --test strips the types).
import assert from "node:assert/strict"
import { test } from "node:test"
import { isCheckoutPausedValue } from "../checkout-paused.ts"

test("only the exact text true pauses checkout", () => {
  assert.equal(isCheckoutPausedValue("true"), true)
  for (const v of [undefined, "", "false", "TRUE", "True", "1", "yes", " true"]) {
    assert.equal(isCheckoutPausedValue(v), false, JSON.stringify(v))
  }
})
