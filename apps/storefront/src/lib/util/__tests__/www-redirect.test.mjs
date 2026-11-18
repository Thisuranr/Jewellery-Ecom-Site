import assert from "node:assert/strict"
import { test } from "node:test"
import { redirectWwwToApex } from "../www-redirect.ts"

test("www goes to the apex, keeping path and query", () => {
  assert.equal(redirectWwwToApex(new URL("https://www.azira.com.au/au/products/x?a=1&b=2")), "https://azira.com.au/au/products/x?a=1&b=2")
  assert.equal(redirectWwwToApex(new URL("https://www.azira.com.au/")), "https://azira.com.au/")
  assert.equal(redirectWwwToApex(new URL("http://WWW.azira.com.au/au")), "https://azira.com.au/au")
})
test("other hosts are left alone", () => {
  for (const u of ["https://azira.com.au/au", "http://localhost:8000/au", "https://admin.azira.com.au/", "https://wwwx.azira.com.au/"]) {
    assert.equal(redirectWwwToApex(new URL(u)), null, u)
  }
})
test("the Host header wins over a normalised URL host", () => {
  assert.equal(redirectWwwToApex(new URL("http://localhost:8000/au?x=1"), "www.azira.com.au"), "https://azira.com.au/au?x=1")
  assert.equal(redirectWwwToApex(new URL("http://localhost:8000/au"), "www.azira.com.au:8000"), "https://azira.com.au/au")
  assert.equal(redirectWwwToApex(new URL("http://localhost:8000/au"), "azira.com.au"), null)
  assert.equal(redirectWwwToApex(new URL("http://localhost:8000/au"), "www.evil.com/x"), null)
})
