import { Metadata } from "next"
import { Suspense } from "react"

import ResetPassword from "@modules/account/components/reset-password"

export const metadata: Metadata = {
  title: "Choose a new password",
  // The link carries a secret token: keep it out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full flex justify-start px-8 py-8">
      <Suspense fallback={null}>
        <ResetPassword />
      </Suspense>
    </div>
  )
}
