import LocalizedClientLink from "../localized-client-link"
type InteractiveLinkProps = {
  href: string
  children?: React.ReactNode
  onClick?: () => void
}

const InteractiveLink = ({
  href,
  children,
  onClick,
  ...props
}: InteractiveLinkProps) => {
  return (
    <LocalizedClientLink
      className="label inline-flex items-center gap-x-2 text-ink link-fade"
      href={href}
      onClick={onClick}
      {...props}
    >
      {children}
      <span aria-hidden>&rarr;</span>
    </LocalizedClientLink>
  )
}

export default InteractiveLink
