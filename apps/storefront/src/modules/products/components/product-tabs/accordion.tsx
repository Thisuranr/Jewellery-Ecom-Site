import { clx } from "@modules/common/components/ui"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import React from "react"

type AccordionItemProps = AccordionPrimitive.AccordionItemProps & {
  title: string
  subtitle?: string
  description?: string
  required?: boolean
  tooltip?: string
  forceMountContent?: true
  headingSize?: "small" | "medium" | "large"
  customTrigger?: React.ReactNode
  complete?: boolean
  active?: boolean
  triggerable?: boolean
  children: React.ReactNode
}

type AccordionProps =
  | (AccordionPrimitive.AccordionSingleProps &
      React.RefAttributes<HTMLDivElement>)
  | (AccordionPrimitive.AccordionMultipleProps &
      React.RefAttributes<HTMLDivElement>)

const Accordion: React.FC<AccordionProps> & {
  Item: React.FC<AccordionItemProps>
} = ({ children, className, ...props }) => {
  return (
    <AccordionPrimitive.Root
      {...props}
      className={clx("border-t border-hairline", className)}
    >
      {children}
    </AccordionPrimitive.Root>
  )
}

const Item: React.FC<AccordionItemProps> = ({
  title,
  subtitle,
  description: _description,
  children,
  className,
  headingSize: _headingSize,
  customTrigger = undefined,
  forceMountContent = undefined,
  triggerable: _triggerable,
  required: _required,
  tooltip: _tooltip,
  complete: _complete,
  active: _active,
  ...props
}) => {
  return (
    <AccordionPrimitive.Item
      {...props}
      className={clx("group border-b border-hairline", className)}
    >
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="flex w-full items-center justify-between py-4 text-left">
          <span className="label text-ink">{title}</span>
          {customTrigger || <PlusMinus />}
        </AccordionPrimitive.Trigger>
        {subtitle && (
          <span className="mb-3 block text-[13px] text-muted">{subtitle}</span>
        )}
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content
        forceMount={forceMountContent}
        className="overflow-hidden radix-state-closed:animate-accordion-close radix-state-open:animate-accordion-open"
      >
        <div className="pb-6">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  )
}

Accordion.Item = Item

const PlusMinus = () => (
  <span className="relative block h-3 w-3 text-ink" aria-hidden>
    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-200 group-radix-state-open:rotate-90" />
  </span>
)

export default Accordion
