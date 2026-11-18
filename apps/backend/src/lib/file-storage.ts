import { MedusaError } from "@medusajs/framework/utils"

/**
 * File Module registration, switchable by FILE_PROVIDER.
 *
 *   unset / local  the local file provider, for development
 *   s3             an S3-compatible bucket (Cloudflare R2 in production; the
 *                  settings are R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *                  R2_ENDPOINT, R2_BUCKET and FILE_URL, the public URL of the
 *                  bucket, https://img.azira.com.au)
 *
 * The File Module takes exactly one provider, so this replaces the default
 * local provider that defineConfig registers. Every message names variables
 * only, never their values (the R2 keys are secrets).
 */

type Env = Record<string, string | undefined>

export type FileModuleConfig = {
  resolve: "@medusajs/medusa/file"
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/file-local" | "@medusajs/medusa/file-s3"
        id: "local" | "s3"
        options: Record<string, unknown>
      },
    ]
  }
}

const DEFAULT_UPLOAD_DIR = "static"
const DEFAULT_PUBLIC_URL = "http://localhost:9000/static"

// Variables the s3 provider cannot work without: [env name, option name].
const S3_REQUIRED = [
  ["FILE_URL", "file_url"],
  ["R2_ACCESS_KEY_ID", "access_key_id"],
  ["R2_SECRET_ACCESS_KEY", "secret_access_key"],
  ["R2_BUCKET", "bucket"],
  ["R2_ENDPOINT", "endpoint"],
] as const

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function fileModuleConfig(env: Env = process.env): FileModuleConfig {
  const provider = present(env.FILE_PROVIDER) ?? "local"

  if (provider === "local") {
    return {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: present(env.FILE_UPLOAD_DIR) ?? DEFAULT_UPLOAD_DIR,
              backend_url: present(env.FILE_PUBLIC_URL) ?? DEFAULT_PUBLIC_URL,
            },
          },
        ],
      },
    }
  }

  if (provider === "s3") {
    const missing = S3_REQUIRED.filter(([name]) => !present(env[name])).map(([name]) => name)
    if (missing.length > 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `FILE_PROVIDER=s3 needs these environment variables: ${missing.join(", ")}`
      )
    }
    const options: Record<string, unknown> = { region: present(env.R2_REGION) ?? "auto" }
    for (const [name, option] of S3_REQUIRED) {
      options[option] = present(env[name])
    }
    // Image URLs are file_url + "/" + key, so a trailing "/" in FILE_URL would give "//".
    options.file_url = (options.file_url as string).replace(/\/+$/, "")
    return {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            // Cloudflare R2 has no object ACLs, so none are sent.
            options: { ...options, acl: false },
          },
        ],
      },
    }
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    'FILE_PROVIDER must be unset, "local" or "s3"'
  )
}
