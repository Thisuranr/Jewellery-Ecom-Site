import { EMAIL_ERROR, emailError } from "./errors"
import { isTemplateName } from "../templates/names"
import { MedusaError } from "@medusajs/framework/utils"

/*
 * Rendering is the only part of the email provider that needs React, and it is
 * kept in this one file on purpose.
 *
 * THE REACT SWITCH:
 * a compiled template starts with require("react/jsx-runtime"), so `react` must
 * be resolvable from project code in the production image, which is built with
 * `pnpm deploy --prod --legacy`. It is therefore a `dependency` of apps/backend
 * (18.3.1, exact); `react-dom` stays a devDependency because @react-email/render
 * resolves it from its own location. If `react` is ever moved back:
 *   - the backend still starts in production (templates and @react-email/components
 *     are required here, when an email is rendered, never at boot);
 *   - boot logs an error saying so (bootProblems in boot-checks.ts);
 *   - an email fails with the coded error `email_render_unavailable`, and
 *     Medusa marks that notification failed.
 */

export type RenderedEmail = { subject: string; html: string; text: string }

type Renderer = {
  templates: (typeof import("../templates"))["templates"]
  render: (typeof import("@react-email/components"))["render"]
}

/** The shape the lazy loader returns; tests replace it (see `setRendererLoader`). */
export type RendererLoader = () => Renderer

const REACT_FIX =
  'move "react" from devDependencies to dependencies in apps/backend/package.json ' +
  "(see the note at the top of render.ts)"

/**
 * null when compiled templates can load React from here, else the reason. It
 * resolves the same specifier a compiled template requires, from a file at the
 * same depth as the templates, so it sees what they will see.
 */
export function reactRuntimeProblem(): string | null {
  try {
    require.resolve("react/jsx-runtime")
    return null
  } catch {
    return `react cannot be resolved from the email templates; ${REACT_FIX}`
  }
}

function isMissingModule(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "MODULE_NOT_FOUND"
  )
}

function defaultLoader(): Renderer {
  try {
    const { templates } = require("../templates") as typeof import("../templates")
    const { render } = require("@react-email/components") as typeof import("@react-email/components")
    return { templates, render }
  } catch (error) {
    if (isMissingModule(error)) {
      // Only the module's name: the message of a MODULE_NOT_FOUND error also
      // lists file paths, which a log has no use for.
      const name = /Cannot find module '([^']+)'/u.exec((error as Error).message)?.[1] ?? "a module"
      throw emailError(
        EMAIL_ERROR.renderUnavailable,
        `cannot load ${name}, so no email can be rendered; ${REACT_FIX}`,
        MedusaError.Types.UNEXPECTED_STATE
      )
    }
    throw error
  }
}

let loader: RendererLoader = defaultLoader

/** For tests: swap the lazy loader. Returns a function that puts the default back. */
export function setRendererLoader(next: RendererLoader): () => void {
  loader = next
  return () => {
    loader = defaultLoader
  }
}

/**
 * Renders a template to a subject, an HTML body and a plain-text body, all in
 * Unicode NFC (a name typed in decomposed Tamil or Sinhala still reaches the
 * reader as the same text, and the mail client's font fallback sees one form).
 *
 * Errors, all coded: `unknown_template`, `invalid_template_data` (from the
 * template's `parse`), `email_render_unavailable` (React missing).
 */
export async function renderEmail(template: string, data: unknown): Promise<RenderedEmail> {
  if (!isTemplateName(template)) {
    throw emailError(EMAIL_ERROR.unknownTemplate, `no email template named "${template}"`)
  }
  const { templates, render } = loader()
  const definition = templates[template]
  const props = definition.parse(data)
  const element = definition.element(props)
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return {
    subject: definition.subject(props).normalize("NFC"),
    html: html.normalize("NFC"),
    text: text.normalize("NFC"),
  }
}
