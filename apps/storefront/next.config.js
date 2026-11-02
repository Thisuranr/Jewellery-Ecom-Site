const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

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
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
