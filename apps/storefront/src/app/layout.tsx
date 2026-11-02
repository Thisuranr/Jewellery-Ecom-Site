import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <head>
        {process.env.UCP_ENABLED === "true" ? <link rel="ucp" href="/.well-known/ucp" /> : null}
      </head>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
