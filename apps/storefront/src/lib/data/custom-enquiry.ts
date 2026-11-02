"use server"

export type CustomEnquiryState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string }

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

const text = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * Sends the custom order form to POST /store/custom-enquiries. The honeypot field `website`
 * is passed on as it is: the backend answers 200 and stores nothing when it is filled.
 */
export async function submitCustomEnquiry(
  _prev: CustomEnquiryState,
  formData: FormData
): Promise<CustomEnquiryState> {
  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/store/custom-enquiries`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
      },
      body: JSON.stringify({
        name: text(formData, "name"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        message: text(formData, "message"),
        budget: text(formData, "budget"),
        website: text(formData, "website"),
      }),
      cache: "no-store",
    })
  } catch {
    return { status: "error", message: "We could not send your request. Please try again in a moment." }
  }

  if (response.ok) {
    return { status: "success" }
  }
  if (response.status === 429) {
    return {
      status: "error",
      message:
        "You have sent a few requests recently. Please wait a little while before sending another.",
    }
  }
  if (response.status === 400) {
    return {
      status: "error",
      message:
        "Please check your details: a name, a valid email address and a message of at least 10 characters are needed.",
    }
  }
  return { status: "error", message: "Something went wrong on our side. Please try again later." }
}
