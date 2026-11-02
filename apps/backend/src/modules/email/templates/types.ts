// Type-only import: erased when compiled, so this file never loads React.
import type { ReactElement } from "react"

/**
 * One email template. `parse` turns the notification's `data` (untrusted in
 * shape, even though our own code writes it) into typed props or throws an
 * `invalid_template_data` error; `subject` and `element` use those props.
 */
export type TemplateDefinition<Props> = {
  parse(data: unknown): Props
  subject(props: Props): string
  element(props: Props): ReactElement
}
