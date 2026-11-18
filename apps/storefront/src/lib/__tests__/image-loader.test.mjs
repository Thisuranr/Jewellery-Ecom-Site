// Run with `pnpm --filter @dtc/storefront test` (node --test strips the types).
import assert from "node:assert/strict"
import { test } from "node:test"
import imageLoader, {
  IMAGE_WIDTHS,
  normalizeImageHost,
  snapWidth,
  transformedImageUrl,
} from "../image-loader.ts"

const HOST = "img.azira.com.au"

test("widths snap up to 320, 640, 960 or 1440", () => {
  assert.deepEqual([...IMAGE_WIDTHS], [320, 640, 960, 1440])
  assert.equal(snapWidth(1), 320)
  assert.equal(snapWidth(300), 320)
  assert.equal(snapWidth(320), 320)
  assert.equal(snapWidth(321), 640)
  assert.equal(snapWidth(700), 960)
  assert.equal(snapWidth(960), 960)
  assert.equal(snapWidth(1000), 1440)
  assert.equal(snapWidth(1440), 1440)
  assert.equal(snapWidth(2000), 1440)
  assert.equal(snapWidth(8192), 1440)
})

test("an image on the image host goes through Cloudflare transformations", () => {
  assert.equal(
    transformedImageUrl("https://img.azira.com.au/azira/ring.jpg", 300, HOST),
    "https://img.azira.com.au/cdn-cgi/image/width=320,quality=75,format=auto/azira/ring.jpg"
  )
  assert.equal(
    transformedImageUrl("https://img.azira.com.au/azira/ring.jpg", 700, HOST),
    "https://img.azira.com.au/cdn-cgi/image/width=960,quality=75,format=auto/azira/ring.jpg"
  )
  assert.equal(
    transformedImageUrl("https://img.azira.com.au/a/b/c.png", 2000, HOST),
    "https://img.azira.com.au/cdn-cgi/image/width=1440,quality=75,format=auto/a/b/c.png"
  )
})

test("the default export reads NEXT_PUBLIC_IMAGE_HOST and ignores next/image's quality", () => {
  const before = process.env.NEXT_PUBLIC_IMAGE_HOST
  try {
    process.env.NEXT_PUBLIC_IMAGE_HOST = HOST
    assert.equal(
      imageLoader({ src: "https://img.azira.com.au/x.jpg", width: 640, quality: 40 }),
      "https://img.azira.com.au/cdn-cgi/image/width=640,quality=75,format=auto/x.jpg"
    )
    delete process.env.NEXT_PUBLIC_IMAGE_HOST
    assert.equal(
      imageLoader({ src: "https://img.azira.com.au/x.jpg", width: 640 }),
      "https://img.azira.com.au/x.jpg"
    )
  } finally {
    if (before === undefined) {
      delete process.env.NEXT_PUBLIC_IMAGE_HOST
    } else {
      process.env.NEXT_PUBLIC_IMAGE_HOST = before
    }
  }
})

test("another host passes through untouched", () => {
  for (const src of [
    "http://localhost:9000/static/1700000000-ring.jpg",
    "https://other.example.com/azira/ring.jpg",
    "https://img.azira.com.au.evil.test/azira/ring.jpg",
    "https://evil.test/img.azira.com.au/ring.jpg",
    "/images/local.png",
    "data:image/png;base64,AAAA",
    "not a url",
  ]) {
    assert.equal(transformedImageUrl(src, 640, HOST), src, src)
  }
})

test("with no image host configured every image passes through", () => {
  const src = "https://img.azira.com.au/azira/ring.jpg"
  for (const host of [undefined, null, "", "   "]) {
    assert.equal(transformedImageUrl(src, 640, host), src)
  }
})

test("a path with spaces is encoded once", () => {
  const encoded =
    "https://img.azira.com.au/cdn-cgi/image/width=640,quality=75,format=auto/azira/my%20ring.jpg"
  assert.equal(
    transformedImageUrl("https://img.azira.com.au/azira/my ring.jpg", 640, HOST),
    encoded
  )
  assert.equal(
    transformedImageUrl("https://img.azira.com.au/azira/my%20ring.jpg", 640, HOST),
    encoded
  )
})

test("a query string survives; a fragment is dropped", () => {
  assert.equal(
    transformedImageUrl("https://img.azira.com.au/x.jpg?v=3#top", 320, HOST),
    "https://img.azira.com.au/cdn-cgi/image/width=320,quality=75,format=auto/x.jpg?v=3"
  )
})

test("an image that is already a transformation URL is not transformed again", () => {
  const src =
    "https://img.azira.com.au/cdn-cgi/image/width=320,quality=75,format=auto/x.jpg"
  assert.equal(transformedImageUrl(src, 960, HOST), src)
})

test("the host setting may carry a scheme, a slash, a port 443 or capitals", () => {
  const expected =
    "https://img.azira.com.au/cdn-cgi/image/width=640,quality=75,format=auto/x.jpg"
  for (const host of [
    "img.azira.com.au",
    "https://img.azira.com.au",
    "https://img.azira.com.au/",
    "IMG.Azira.COM.AU",
    "img.azira.com.au:443",
  ]) {
    assert.equal(
      transformedImageUrl("https://img.azira.com.au/x.jpg", 640, host),
      expected,
      host
    )
  }
  assert.equal(normalizeImageHost(" https://IMG.azira.com.au/a?b "), "img.azira.com.au")
})

test("an http URL on the image host is upgraded to https", () => {
  assert.equal(
    transformedImageUrl("http://img.azira.com.au/x.jpg", 320, HOST),
    "https://img.azira.com.au/cdn-cgi/image/width=320,quality=75,format=auto/x.jpg"
  )
})
