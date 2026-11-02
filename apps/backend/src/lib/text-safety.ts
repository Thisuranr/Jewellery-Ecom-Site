/**
 * Control characters that Postgres or an email header cannot take: NUL (which makes an INSERT fail with a 500)
 * and the rest of C0 and DEL and C1, except tab, line feed and carriage return.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u

export function hasControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value)
}

export const CONTROL_CHARS_MESSAGE = "must not contain control characters"
