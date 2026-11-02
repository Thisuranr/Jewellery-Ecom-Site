"use client"

import { submitCustomEnquiry, type CustomEnquiryState } from "@lib/data/custom-enquiry"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { Label } from "@modules/common/components/ui"
import { useActionState } from "react"

const initialState: CustomEnquiryState = { status: "idle" }

export default function CustomOrderForm() {
  const [state, formAction] = useActionState(submitCustomEnquiry, initialState)

  if (state.status === "success") {
    return (
      <div
        className="border border-ui-border-base rounded-rounded p-6 bg-ui-bg-subtle"
        data-testid="custom-order-success"
        role="status"
      >
        <p className="text-base-semi mb-2">Thank you, we have your request.</p>
        <p className="text-base-regular text-ui-fg-subtle">
          We have emailed you a confirmation and will reply by email as soon as we can.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-y-4 max-w-xl" data-testid="custom-order-form">
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
      <div className="flex flex-col w-full">
        <Label htmlFor="custom-order-message" className="mb-2 txt-compact-medium-plus">
          What do you have in mind?
        </Label>
        <textarea
          id="custom-order-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          className="w-full rounded-rounded border border-ui-border-base bg-ui-bg-field p-3 text-base-regular"
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
      <SubmitButton className="w-full sm:w-auto" data-testid="custom-order-submit">
        Send request
      </SubmitButton>
    </form>
  )
}
