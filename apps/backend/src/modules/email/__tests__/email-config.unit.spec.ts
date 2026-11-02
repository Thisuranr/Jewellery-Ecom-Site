import { emailNotificationModule, emailProviderOptionsFromEnv } from "../../../lib/email-config"

describe("emailProviderOptionsFromEnv", () => {
  it("defaults to the console transport with no key", () => {
    expect(emailProviderOptionsFromEnv({}).transport).toBe("console")
    expect(emailProviderOptionsFromEnv({ RESEND_API_KEY: "  " }).transport).toBe("console")
  })
  it("uses Resend when a key is set, unless EMAIL_TRANSPORT says otherwise", () => {
    expect(emailProviderOptionsFromEnv({ RESEND_API_KEY: "re_x" }).transport).toBe("resend")
    expect(emailProviderOptionsFromEnv({ RESEND_API_KEY: "re_x", EMAIL_TRANSPORT: "Console" }).transport).toBe("console")
  })
  it("passes an unknown transport on so the provider refuses to boot", () => {
    expect(emailProviderOptionsFromEnv({ EMAIL_TRANSPORT: "smtp" }).transport).toBe("smtp")
  })
})

describe("emailNotificationModule", () => {
  it("keeps the local feed provider and adds the email provider", () => {
    const providers = emailNotificationModule({}).options.providers
    expect(providers.map((p) => p.id)).toEqual(["local", "email"])
    expect(providers[1].options.channels).toEqual(["email"])
  })
})
