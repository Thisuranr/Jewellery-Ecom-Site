import { bootProblems, reportBootProblems } from "../lib/boot-checks"
import { parseEmailOptions } from "../lib/options"
import EmailNotificationProviderService from "../service"

// Plan M3 E1: "With console transport in production, log a warning at boot."
// And the react switch (P0-B finding): a production image without react must
// say so at boot instead of failing silently at the first reset.

const CONSOLE = parseEmailOptions({ transport: "console" })
const CONSOLE_WITH_OUTBOX = parseEmailOptions({ transport: "console", outbox_dir: "/var/outbox" })
const RESEND = parseEmailOptions({ transport: "resend", api_key: "re_x", from: "a@b.com.au" })
const REACT_PROBLEM = "react cannot be resolved from the email templates; move react"

function loggerSpy() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe("bootProblems", () => {
  it("is silent for the console transport outside production with React available", () => {
    expect(bootProblems({ options: CONSOLE, production: false, reactProblem: null })).toEqual([])
    expect(bootProblems({ options: CONSOLE_WITH_OUTBOX, production: false, reactProblem: null })).toEqual([])
  })

  it("is silent for Resend in production with React available", () => {
    expect(bootProblems({ options: RESEND, production: true, reactProblem: null })).toEqual([])
  })

  it("warns that the console transport in production reaches no customer", () => {
    const problems = bootProblems({ options: CONSOLE, production: true, reactProblem: null })
    expect(problems).toHaveLength(1)
    expect(problems[0].level).toBe("warn")
    expect(problems[0].message).toContain("console transport is active in production")
    expect(problems[0].message).toContain("RESEND_API_KEY")
  })

  it("also warns that the outbox folder is ignored in production", () => {
    const problems = bootProblems({ options: CONSOLE_WITH_OUTBOX, production: true, reactProblem: null })
    expect(problems.map((p) => p.level)).toEqual(["warn", "warn"])
    expect(problems[1].message).toContain("EMAIL_OUTBOX_DIR is ignored in production")
  })

  it("does not mention the outbox when the transport is Resend", () => {
    const options = parseEmailOptions({ transport: "resend", api_key: "re_x", from: "a@b.com.au", outbox_dir: "/x" })
    expect(bootProblems({ options, production: true, reactProblem: null })).toEqual([])
  })

  it("logs an error, in every environment and for either transport, when React cannot be loaded", () => {
    for (const options of [CONSOLE, RESEND]) {
      for (const production of [false, true]) {
        const problems = bootProblems({ options, production, reactProblem: REACT_PROBLEM })
        const error = problems.find((p) => p.level === "error")
        expect(error?.message).toContain(REACT_PROBLEM)
        expect(error?.message).toContain("email_render_unavailable")
      }
    }
  })
})

describe("reportBootProblems", () => {
  it("sends each problem to the logger at its level and returns them", () => {
    const logger = loggerSpy()
    const problems = reportBootProblems(CONSOLE_WITH_OUTBOX, logger, { NODE_ENV: "production" }, REACT_PROBLEM)
    expect(problems).toHaveLength(3)
    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.info).not.toHaveBeenCalled()
  })

  // R1 #3: NODE_ENV=prod is production for Medusa and production-env.ts.
  it("warns about the console transport with NODE_ENV=prod too", () => {
    const logger = loggerSpy()
    const problems = reportBootProblems(CONSOLE, logger, { NODE_ENV: "prod" }, null)
    expect(problems.map((p) => p.message).join(" ")).toContain("console transport is active in production")
  })

  it("logs nothing for a healthy development setup", () => {
    const logger = loggerSpy()
    expect(reportBootProblems(CONSOLE, logger, { NODE_ENV: "development" }, null)).toEqual([])
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("runs from the provider's validateOptions with Medusa's logger", () => {
    jest.resetModules()
    const warn = jest.fn()
    jest.doMock("@medusajs/framework/logger", () => ({ logger: { info: jest.fn(), warn, error: jest.fn() } }))
    const saved = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      const Service = require("../service").default as typeof EmailNotificationProviderService
      Service.validateOptions({ channels: ["email"], transport: "console" })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toContain("console transport is active in production")
    } finally {
      process.env.NODE_ENV = saved
      jest.dontMock("@medusajs/framework/logger")
      jest.resetModules()
    }
  })
})

