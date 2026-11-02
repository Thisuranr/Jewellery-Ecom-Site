"use client"

import { submitCustomEnquiry, type CustomEnquiryState } from "@lib/data/custom-enquiry"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"

const initialState: CustomEnquiryState = { status: "idle" }

export default function CustomOrderForm({
  initialMessage,
}: {
  initialMessage?: string
}) {
  const [state, formAction] = useActionState(submitCustomEnquiry, initialState)

  if (state.status === "success") {
    return (
      <div
        className="bg-surface p-8"
        data-testid="custom-order-success"
        role="status"
      >
        <p className="mb-2 font-display text-[28px] leading-tight">Thank you, we have your request.</p>
        <p className="text-muted">
          We have emailed you a confirmation and will reply by email as soon as we can.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-y-6" data-testid="custom-order-form">
      <Input label="Name" name="name" autoComplete="name" required maxLength={100} data-testid="custom-order-name" />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        data-testid="custom-order-email"
      />
      <Input label="Phone (optional)" name="phone" type="tel" autoComplete="tel" maxLength={30} data-testid="custom-order-phone" />
      <div className="flex w-full flex-col gap-y-1.5">
        <label
          htmlFor="custom-order-message"
          className="text-[12px] font-medium uppercase leading-4 tracking-[0.12em] text-muted"
        >
          What do you have in mind? *
        </label>
        <textarea
          id="custom-order-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          defaultValue={initialMessage}
          className="field"
          data-testid="custom-order-message"
        />
      </div>
      <Input label="Budget (optional)" name="budget" maxLength={100} data-testid="custom-order-budget" />
      {/* Honeypot: people never see or fill this; bots do. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="custom-order-website">Leave this field empty</label>
        <input id="custom-order-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <ErrorMessage error={state.status === "error" ? state.message : null} data-testid="custom-order-error" />
      <SubmitButton className="w-full sm:w-auto sm:self-start" data-testid="custom-order-submit">
        Send request
      </SubmitButton>
    </form>
  )
}
