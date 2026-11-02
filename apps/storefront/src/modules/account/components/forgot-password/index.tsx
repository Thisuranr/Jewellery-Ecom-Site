"use client"

import { requestPasswordReset } from "@lib/data/password-reset"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useActionState } from "react"

const ForgotPassword = () => {
  const [state, formAction] = useActionState(requestPasswordReset, null)

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="forgot-password-page"
    >
      <h1 className="text-large-semi uppercase mb-6">Reset your password</h1>
      {state?.state === "sent" ? (
        <p
          className="text-center text-base-regular text-ink mb-8"
          data-testid="forgot-password-sent"
        >
          If an account exists for that email address, we have sent a link to
          reset the password. Please check your inbox.
        </p>
      ) : (
        <>
          <p className="text-center text-base-regular text-ink mb-8">
            Enter your email address and we will send you a link to choose a
            new password.
          </p>
          <form className="w-full" action={formAction}>
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              data-testid="forgot-email-input"
            />
            <ErrorMessage
              error={state?.state === "error" ? state.error : null}
              data-testid="forgot-password-error"
            />
            <SubmitButton data-testid="forgot-submit-button" className="w-full mt-6">
              Send reset link
            </SubmitButton>
          </form>
        </>
      )}
      <LocalizedClientLink
        href="/account"
        className="underline text-small-regular mt-6"
        data-testid="back-to-sign-in"
      >
        Back to sign in
      </LocalizedClientLink>
    </div>
  )
}

export default ForgotPassword
