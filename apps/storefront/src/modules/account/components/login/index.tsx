import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Login = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(login, null)

  return (
    <div
      className="flex w-full max-w-sm flex-col"
      data-testid="login-page"
    >
      <h1 className="mb-3 text-center font-display text-[38px] font-normal leading-tight">
        Welcome back
      </h1>
      <p className="mb-10 text-center text-muted">
        Sign in to see your orders and saved addresses.
      </p>
      {message?.state === "verification_required" && (
        <div
          className="mb-6 w-full bg-surface p-4 text-center text-[14px]"
          data-testid="login-verification-message"
        >
          We sent a verification link to <strong>{message.email}</strong>.
          Please verify your email, then sign in.
        </div>
      )}
      <form className="w-full" action={formAction}>
        <div className="flex w-full flex-col gap-y-5">
          <Input
            label="Email"
            name="email"
            type="email"
            title="Enter a valid email address."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="login-error-message"
        />
        <SubmitButton data-testid="sign-in-button" size="large" className="mt-6 w-full">
          Sign in
        </SubmitButton>
      </form>
      <LocalizedClientLink
        href="/account/forgot-password"
        className="mt-5 self-center text-[14px] font-light text-muted underline decoration-strong underline-offset-4 hover:text-ink"
        data-testid="forgot-password-link"
      >
        Forgot password?
      </LocalizedClientLink>
      <span className="mt-8 border-t border-hairline pt-6 text-center text-[14px] font-light text-muted">
        Not a member?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="text-ink underline underline-offset-4"
          data-testid="register-button"
        >
          Join us
        </button>
        .
      </span>
    </div>
  )
}

export default Login
