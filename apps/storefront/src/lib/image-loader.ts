/**
 * The `next/image` loader . Registered in
 * `next.config.mjs` as `images.loaderFile`, so `/_next/image` is never used and
 * the Worker does no image work.
 *
 * An image on the image host (`NEXT_PUBLIC_IMAGE_HOST`, for example
 * `img.azira.com.au`) is sent through Cloudflare Image Transformations:
 *
 *   https://<host>/cdn-cgi/image/width=<w>,quality=75,format=auto/<path>
 *
 * The width snaps up to one of four sizes and the quality is fixed, so one
 * picture has at most four transformed variants. Cloudflare's free plan
 * counts unique transformations (5,000 a month), and a free-form width would
 * make every screen size a new one. Images on any other host (the local
 * `/static` files of the dev backend, a relative URL) are returned untouched.
 *
 * Pure: no path aliases and no `next/*` imports, so `node --test` can load it.
 */

/** The only widths ever requested. Keep in step with `images.deviceSizes`. */
export const IMAGE_WIDTHS = [320, 640, 960, 1440] as const

/** One quality for every variant, so the variant count stays at four. */
export const IMAGE_QUALITY = 75

/** The smallest allowed width that is at least `width` (the largest for more). */
export const snapWidth = (width: number): number =>
  IMAGE_WIDTHS.find((candidate) => candidate >= width) ??
  IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]

/**
 * `img.azira.com.au`, `https://img.azira.com.au/` and `IMG.example.lk:443` all name
 * the same host. Returns "" when the value is unset or blank.
 */
export const normalizeImageHost = (value: string | undefined | null): string =>
  (value ?? "")
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/:443$/, "")
    .toLowerCase()

/**
 * The URL to load for `src` at `width`. `imageHost` is the configured host
 * (`NEXT_PUBLIC_IMAGE_HOST`); with none, or for another host, `src` is returned
 * as it came.
 */
export const transformedImageUrl = (
  src: string,
  width: number,
  imageHost: string | undefined | null
): string => {
  const host = normalizeImageHost(imageHost)
  if (!host || !/^https?:\/\//i.test(src)) {
    return src
  }

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return src
  }

  if (url.host.toLowerCase() !== host.replace(/:443$/, "")) {
    return src
  }
  // Already a transformation URL: do not transform twice.
  if (url.pathname.startsWith("/cdn-cgi/")) {
    return src
  }

  // `url.pathname` is already percent-encoded once ("my image.jpg" becomes
  // "my%20image.jpg", and an existing "%20" is left alone).
  const options = `width=${snapWidth(width)},quality=${IMAGE_QUALITY},format=auto`
  return `https://${url.host}/cdn-cgi/image/${options}${url.pathname}${url.search}`
}

export default function imageLoader({
  src,
  width,
}: {
  src: string
  width: number
  quality?: number
}): string {
  return transformedImageUrl(src, width, process.env.NEXT_PUBLIC_IMAGE_HOST)
}
