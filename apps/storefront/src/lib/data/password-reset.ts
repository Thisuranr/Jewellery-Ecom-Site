"use server"

import { sdk } from "@lib/config"

export type ResetState =
  | { state: "sent" }
  | { state: "done" }
  | { state: "error"; error: string }
  | null

const MIN_PASSWORD = 8

// Asks the backend to email a reset link. The answer is always the same, whether or not the address has an
// account, so nobody can use this form to find out who is registered.
export async function requestPasswordReset(
  _state: ResetState,
  formData: FormData
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim()
  if (!email || !email.includes("@")) {
    return { state: "error", error: "Enter a valid email address." }
  }
  try {
    await sdk.auth.resetPassword("customer", "emailpass", { identifier: email })
  } catch {
    // Deliberately ignored: see above.
  }
  return { state: "sent" }
}

export async function submitNewPassword(
  _state: ResetState,
  formData: FormData
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "")
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm_password") ?? "")

  if (!token || !email) {
    return {
      state: "error",
      error: "This reset link is not valid. Please request a new one.",
    }
  }
  if (password.length < MIN_PASSWORD) {
    return {
      state: "error",
      error: `Your password must be at least ${MIN_PASSWORD} characters.`,
    }
  }
  if (password !== confirm) {
    return { state: "error", error: "The two passwords do not match." }
  }

  try {
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { email, password } as { password: string },
      token
    )
  } catch {
    return {
      state: "error",
      error:
        "This reset link has expired or was already used. Please request a new one.",
    }
  }
  return { state: "done" }
}
