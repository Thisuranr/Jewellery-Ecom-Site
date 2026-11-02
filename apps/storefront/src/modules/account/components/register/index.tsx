"use client"

import { useActionState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import { STORE_NAME } from "@lib/store-name"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)

  return (
    <div
      className="flex w-full max-w-sm flex-col"
      data-testid="register-page"
    >
      <h1 className="mb-3 text-center font-display text-[38px] font-normal leading-tight">
        Create an account
      </h1>
      <p className="mb-10 text-center text-muted">
        Join {STORE_NAME} to track orders and check out faster.
      </p>
      {message?.state === "verification_required" && (
        <div
          className="mb-6 w-full bg-surface p-4 text-center text-[14px]"
          data-testid="register-verification-message"
        >
          We sent a verification link to <strong>{message.email}</strong>.
          Please check your inbox to verify your email, then sign in.
        </div>
      )}
      <form className="w-full flex flex-col" action={formAction}>
        <div className="flex w-full flex-col gap-y-5">
          <Input
            label="First name"
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label="Last name"
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            label="Email"
            name="email"
            required
            type="email"
            autoComplete="email"
            data-testid="email-input"
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            label="Password"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="register-error"
        />
        <span className="mt-6 text-center text-[13px] font-light text-muted">
          By creating an account, you agree to {STORE_NAME}&apos;s{" "}
          <LocalizedClientLink
            href="/content/privacy-policy"
            className="underline"
          >
            Privacy Policy
          </LocalizedClientLink>{" "}
          and{" "}
          <LocalizedClientLink
            href="/content/terms-of-use"
            className="underline"
          >
            Terms of Use
          </LocalizedClientLink>
          .
        </span>
        <SubmitButton size="large" className="mt-6 w-full" data-testid="register-button">
          Join
        </SubmitButton>
      </form>
      <span className="mt-8 border-t border-hairline pt-6 text-center text-[14px] font-light text-muted">
        Already a member?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="text-ink underline underline-offset-4"
        >
          Sign in
        </button>
        .
      </span>
    </div>
  )
}

export default Register
