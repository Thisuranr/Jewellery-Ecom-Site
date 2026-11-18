import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import checkEnvVariables from "./check-env-variables.js"

// Makes the Cloudflare bindings declared in wrangler.jsonc available to `next dev`.
initOpenNextCloudflareForDev()

checkEnvVariables()

// AI-agent checkout (UCP) is off unless UCP_ENABLED=true: its totals are not GST-correct, and the
// client does not need it. When off, every UCP URL is a 404 and nothing links to it.
const UCP_ENABLED = process.env.UCP_ENABLED === "true"

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      ...(UCP_ENABLED
        ? [
            {
              source: "/:path*",
              headers: [{ key: "Link", value: '</.well-known/ucp>; rel="ucp"' }],
            },
          ]
        : []),
      {
        source: "/:countryCode/products/:handle",
        headers: [{ key: "Vary", value: "Accept" }],
      },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        ...(UCP_ENABLED
          ? []
          : [
              // A route that answers 404 (src/app/ucp-disabled).
              "/ucp/:path*",
              "/.well-known/ucp",
              "/buy/:items",
              "/:countryCode/cart/resume/:cartId",
            ].map((source) => ({ source, destination: "/ucp-disabled" }))),
        {
          source: "/:countryCode/products/:handle([^/.]+).md",
          destination: "/:countryCode/products/:handle/markdown",
        },
        {
          source: "/:countryCode/products/:handle([^/.]+)",
          has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
          destination: "/:countryCode/products/:handle/markdown",
        },
      ],
    }
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Product images go through Cloudflare Image Transformations on the image
  // host (img.azira.com.au). A custom loader means /_next/image is never used,
  // so the Worker does no image work. Four widths keep the number of
  // transformations low; see src/lib/image-loader.ts. Images on any other host
  // (the local /static files of the dev backend) are loaded untouched.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [320, 640, 960, 1440],
    imageSizes: [],
  },
}

export default nextConfig
