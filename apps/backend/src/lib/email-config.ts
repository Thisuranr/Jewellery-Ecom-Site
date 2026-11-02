/**
 * Email settings from the environment . Used by
 * medusa-config.ts.
 *
 * | variable           | meaning                                                         |
 * | EMAIL_TRANSPORT    | console or resend. Empty or unset: resend when RESEND_API_KEY   |
 * |                    | is set, console otherwise                                       |
 * | RESEND_API_KEY     | the Resend key; required when the transport is resend           |
 * | EMAIL_FROM         | the sender; required when the transport is resend               |
 * | EMAIL_REPLY_TO     | optional, the monitored inbox                                   |
 * | EMAIL_OUTBOX_DIR   | optional, console only and never in production: HTML copies     |
 *
 * An empty value counts as unset (a copied .env.template ships them empty).
 * An EMAIL_TRANSPORT that names no transport is passed on as it is, so the
 * provider's validateOptions stops the boot with a clear message instead of
 * the config quietly choosing console.
 */

export type EmailOptionsFromEnv = {
  transport: string
  from?: string
  reply_to?: string
  api_key?: string
  outbox_dir?: string
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function emailProviderOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): EmailOptionsFromEnv {
  const apiKey = clean(env.RESEND_API_KEY)
  const explicit = clean(env.EMAIL_TRANSPORT)?.toLowerCase()
  return {
    transport: explicit ?? (apiKey ? "resend" : "console"),
    from: clean(env.EMAIL_FROM),
    reply_to: clean(env.EMAIL_REPLY_TO),
    api_key: apiKey,
    outbox_dir: clean(env.EMAIL_OUTBOX_DIR),
  }
}

/**
 * The notification module entry for medusa-config.ts.
 *
 * Giving the module its own `providers` list replaces Medusa's default list,
 * which holds the local provider for the `feed` channel. That channel carries
 * the admin's "your export is ready" and "your import finished" notifications
 * (core-flows: export-products, import-products, export-orders and others), so
 * the local provider is listed again here, unchanged from defineConfig's.
 */
export function emailNotificationModule(env: NodeJS.ProcessEnv = process.env) {
  return {
    resolve: "@medusajs/medusa/notification",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/notification-local",
          id: "local",
          options: {
            name: "Local Notification Provider",
            channels: ["feed"],
          },
        },
        {
          resolve: "./src/modules/email",
          id: "email",
          options: {
            channels: ["email"],
            ...emailProviderOptionsFromEnv(env),
          },
        },
      ],
    },
  }
}
