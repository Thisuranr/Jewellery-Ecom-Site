import { Metadata } from "next"

import Link from "next/link"

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you tried to access does not exist.",
}

export default function NotFound() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-y-4 px-4 py-24 text-center"
      data-testid="not-found"
    >
      <p className="label text-muted">404</p>
      <h1 className="font-display text-[38px] font-normal leading-tight small:text-[52px]">
        Page not found
      </h1>
      <p className="mb-4 max-w-md text-muted">
        The page you tried to reach does not exist, or has moved.
      </p>
      <Link href="/" className="label inline-flex items-center gap-x-2 text-ink link-fade">
        Back to the home page <span aria-hidden>&rarr;</span>
      </Link>
    </div>
  )
}
