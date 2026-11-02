import { isProduction, type EmailLogger } from "./transports"
import type { EmailProviderOptions } from "./options"
import { reactRuntimeProblem } from "./render"

export type BootProblem = { level: "warn" | "error"; message: string }

/**
 * Things that are legal but wrong to leave unnoticed, found when the provider's
 * options are validated at boot. Pure: `production` and `reactProblem` are
 * passed in so a test can set them.
 */
export function bootProblems(input: {
  options: EmailProviderOptions
  production: boolean
  reactProblem: string | null
}): BootProblem[] {
  const { options, production, reactProblem } = input
  const problems: BootProblem[] = []

  if (production && options.transport === "console") {
    problems.push({
      level: "warn",
      message:
        "[email] the console transport is active in production: no email reaches any customer, " +
        "so password resets cannot work. Set EMAIL_TRANSPORT=resend and RESEND_API_KEY.",
    })
    if (options.outbox_dir) {
      problems.push({
        level: "warn",
        message:
          "[email] EMAIL_OUTBOX_DIR is ignored in production: an outbox would hold password-reset links.",
      })
    }
  }

  if (reactProblem) {
    problems.push({
      level: "error",
      message: `[email] ${reactProblem}. Until then every email fails with email_render_unavailable.`,
    })
  }

  return problems
}

function frameworkLogger(): EmailLogger {
  // Required here, not imported at the top: the framework's reporter is heavy
  // and only boot needs it.
  return (require("@medusajs/framework/logger") as { logger: EmailLogger }).logger
}

/** Logs `bootProblems` for the current process. Called by the provider's validateOptions. */
export function reportBootProblems(
  options: EmailProviderOptions,
  logger: EmailLogger = frameworkLogger(),
  env: NodeJS.ProcessEnv = process.env,
  reactProblem: string | null = reactRuntimeProblem()
): BootProblem[] {
  const problems = bootProblems({ options, production: isProduction(env), reactProblem })
  for (const problem of problems) {
    logger[problem.level](problem.message)
  }
  return problems
}
