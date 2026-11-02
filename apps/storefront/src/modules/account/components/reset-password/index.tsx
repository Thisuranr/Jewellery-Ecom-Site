"use client"

import { submitNewPassword } from "@lib/data/password-reset"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useSearchParams } from "next/navigation"
import { useActionState } from "react"

const ResetPassword = () => {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const email = params.get("email") ?? ""
  const [state, formAction] = useActionState(submitNewPassword, null)

  if (state?.state === "done") {
    return (
      <div
        className="max-w-sm w-full flex flex-col items-center"
        data-testid="reset-password-done"
      >
        <h1 className="text-large-semi uppercase mb-6">Password updated</h1>
        <p className="text-center text-base-regular text-ink mb-6">
          Your password has been changed. You can now sign in with it.
        </p>
        <LocalizedClientLink
          href="/account"
          className="underline"
          data-testid="reset-sign-in-link"
        >
          Sign in
        </LocalizedClientLink>
      </div>
    )
  }

  if (!token || !email) {
    return (
      <div
        className="max-w-sm w-full flex flex-col items-center"
        data-testid="reset-password-invalid"
      >
        <h1 className="text-large-semi uppercase mb-6">Reset your password</h1>
        <p className="text-center text-base-regular text-ink mb-6">
          This reset link is not valid. Please request a new one.
        </p>
        <LocalizedClientLink href="/account/forgot-password" className="underline">
          Request a new link
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="reset-password-page"
    >
      <h1 className="text-large-semi uppercase mb-6">Choose a new password</h1>
      <p className="text-center text-base-regular text-ink mb-8">
        for <strong>{email}</strong>
      </p>
      <form className="w-full" action={formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={email} />
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            data-testid="new-password-input"
          />
          <Input
            label="Confirm new password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            data-testid="confirm-password-input"
          />
        </div>
        <ErrorMessage
          error={state?.state === "error" ? state.error : null}
          data-testid="reset-password-error"
        />
        {state?.state === "error" && (
          <LocalizedClientLink
            href="/account/forgot-password"
            className="underline text-small-regular block mt-2"
          >
            Request a new link
          </LocalizedClientLink>
        )}
        <SubmitButton data-testid="reset-submit-button" className="w-full mt-6">
          Update password
        </SubmitButton>
      </form>
    </div>
  )
}

export default ResetPassword
