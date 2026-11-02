import { clx } from "@modules/common/components/ui"

const Divider = ({ className }: { className?: string }) => (
  <div className={clx("h-px w-full bg-hairline", className)} />
)

export default Divider
