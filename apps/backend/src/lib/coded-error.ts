import { MedusaError } from "@medusajs/framework/utils"

export type MedusaErrorType = (typeof MedusaError.Types)[keyof typeof MedusaError.Types]

/**
 * A MedusaError whose message starts with a machine-readable code:
 * "<code>: <text>". The js-sdk keeps only the message (M0 H1 #6), so clients
 * read the code from its prefix (plan M1, decision 10).
 */
export function codedError(type: MedusaErrorType, code: string, text: string): MedusaError {
  return new MedusaError(type, `${code}: ${text}`)
}

/** The "<code>" prefix of a coded error message, or null. */
export function errorCode(message: string | undefined | null): string | null {
  const match = /^([a-z][a-z0-9_]*): /.exec(message ?? "")
  return match ? match[1] : null
}
