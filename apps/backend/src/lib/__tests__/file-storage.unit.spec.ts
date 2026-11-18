import { fileModuleConfig } from "../file-storage"

const S3_ENV = {
  FILE_PROVIDER: "s3",
  FILE_URL: "https://img.example.test",
  R2_ACCESS_KEY_ID: "AKIA-fake-key-id",
  R2_SECRET_ACCESS_KEY: "fake-secret-value-123",
  R2_BUCKET: "azira-images",
  R2_ENDPOINT: "https://0123abcd.r2.cloudflarestorage.com",
}

function thrownMessage(env: Record<string, string | undefined>): string {
  try {
    fileModuleConfig(env)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error("expected fileModuleConfig to throw")
}

describe("fileModuleConfig: local", () => {
  it("uses the local provider with the static defaults when nothing is set", () => {
    expect(fileModuleConfig({})).toStrictEqual({
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: "http://localhost:9000/static",
            },
          },
        ],
      },
    })
  })

  it("treats FILE_PROVIDER=local and an empty value like unset", () => {
    const unset = fileModuleConfig({})
    expect(fileModuleConfig({ FILE_PROVIDER: "local" })).toStrictEqual(unset)
    expect(fileModuleConfig({ FILE_PROVIDER: "" })).toStrictEqual(unset)
    expect(fileModuleConfig({ FILE_PROVIDER: "  " })).toStrictEqual(unset)
  })

  it("takes a custom directory and public URL", () => {
    const config = fileModuleConfig({
      FILE_UPLOAD_DIR: "C:/tmp/uploads",
      FILE_PUBLIC_URL: "http://localhost:9100/static",
    })
    expect(config.options.providers[0].options).toStrictEqual({
      upload_dir: "C:/tmp/uploads",
      backend_url: "http://localhost:9100/static",
    })
  })

  it("falls back to the defaults for empty directory and URL values", () => {
    const config = fileModuleConfig({ FILE_UPLOAD_DIR: "", FILE_PUBLIC_URL: " " })
    expect(config.options.providers[0].options).toStrictEqual({
      upload_dir: "static",
      backend_url: "http://localhost:9000/static",
    })
  })

  it("ignores the S3 variables while the provider is local", () => {
    const config = fileModuleConfig({ ...S3_ENV, FILE_PROVIDER: "local" })
    expect(config.options.providers[0].id).toBe("local")
  })
})

describe("fileModuleConfig: s3", () => {
  it("builds the S3-compatible provider for R2 (no ACLs, region auto)", () => {
    expect(fileModuleConfig(S3_ENV)).toStrictEqual({
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: "https://img.example.test",
              access_key_id: "AKIA-fake-key-id",
              secret_access_key: "fake-secret-value-123",
              region: "auto",
              bucket: "azira-images",
              endpoint: "https://0123abcd.r2.cloudflarestorage.com",
              acl: false,
            },
          },
        ],
      },
    })
  })

  it("takes R2_REGION when it is set", () => {
    const config = fileModuleConfig({ ...S3_ENV, R2_REGION: "ap-south-1" })
    expect(config.options.providers[0].options.region).toBe("ap-south-1")
  })

  it.each([
    "FILE_URL",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
  ])("names %s when it is missing, and prints no value", (name) => {
    const env: Record<string, string | undefined> = { ...S3_ENV }
    delete env[name]
    const message = thrownMessage(env)
    expect(message).toContain(name)
    for (const [key, value] of Object.entries(S3_ENV)) {
      if (key === "FILE_PROVIDER") continue
      expect(message).not.toContain(value)
    }
  })

  it("treats a blank variable as missing", () => {
    expect(thrownMessage({ ...S3_ENV, R2_BUCKET: "   " })).toContain("R2_BUCKET")
  })

  it("lists every missing variable at once", () => {
    const message = thrownMessage({ FILE_PROVIDER: "s3" })
    for (const name of [
      "FILE_URL",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "R2_ENDPOINT",
    ]) {
      expect(message).toContain(name)
    }
  })
})

describe("fileModuleConfig: other providers", () => {
  it.each(["gcs", "S3", "localfs", "none"])("throws for %j without printing it", (provider) => {
    const message = thrownMessage({ ...S3_ENV, FILE_PROVIDER: provider })
    expect(message).toContain("FILE_PROVIDER")
    expect(message).not.toContain(provider)
  })

  it("ignores surrounding spaces around a valid provider", () => {
    expect(fileModuleConfig({ ...S3_ENV, FILE_PROVIDER: " s3 " }).options.providers[0].id).toBe("s3")
  })
})

describe("medusa-config wiring", () => {
  it("registers exactly one file provider, the one fileModuleConfig() returns", () => {
    const saved = process.env.FILE_PROVIDER
    delete process.env.FILE_PROVIDER
    try {
      let config: { modules: Record<string, { resolve?: string; options?: unknown }> } | undefined
      jest.isolateModules(() => {
        config = require("../../../medusa-config")
      })
      const fileModule = Object.values(config!.modules).find(
        (module) => module?.resolve === "@medusajs/medusa/file"
      )
      expect(fileModule).toBeDefined()
      // medusa-config loads the env files itself, so compare against the env it saw.
      expect(fileModule!.options).toStrictEqual(fileModuleConfig(process.env).options)
    } finally {
      if (saved !== undefined) process.env.FILE_PROVIDER = saved
    }
  })

  it("strips trailing slashes from FILE_URL so image URLs have no //", () => {
    for (const url of ["https://img.example.test/", "https://img.example.test///"]) {
      const cfg = fileModuleConfig({ ...S3_ENV, FILE_URL: url })
      expect((cfg.options.providers[0].options as Record<string, unknown>).file_url).toBe("https://img.example.test")
    }
  })
})
