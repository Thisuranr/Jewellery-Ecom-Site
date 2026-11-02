import { deleteLineItem } from "@lib/data/cart"
import { notifyCartUpdated } from "@lib/util/cart-events"
import { clx } from "@modules/common/components/ui"
import { useState } from "react"

const DeleteButton = ({
  id,
  children,
  className,
  "data-testid": testId,
}: {
  id: string
  children?: React.ReactNode
  className?: string
  "data-testid"?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    await deleteLineItem(id)
      .then(notifyCartUpdated)
      .catch((_err) => {
        setIsDeleting(false)
      })
  }

  return (
    <div className={clx("flex items-center", className)}>
      <button
        type="button"
        className="text-[13px] font-light text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-ink disabled:opacity-50"
        onClick={() => handleDelete(id)}
        disabled={isDeleting}
        data-testid={testId}
      >
        {isDeleting ? "Removing..." : children ?? "Remove"}
      </button>
    </div>
  )
}

export default DeleteButton
