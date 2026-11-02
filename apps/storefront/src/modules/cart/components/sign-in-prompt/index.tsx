import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="flex items-center justify-between gap-x-4 border border-hairline px-5 py-4">
      <p className="text-[14px] font-light text-muted">
        Already have an account?{" "}
        <span className="hidden sm:inline">Sign in for a faster checkout.</span>
      </p>
      <LocalizedClientLink
        href="/account"
        className="label shrink-0 text-ink link-fade"
        data-testid="sign-in-button"
      >
        Sign in
      </LocalizedClientLink>
    </div>
  )
}

export default SignInPrompt
