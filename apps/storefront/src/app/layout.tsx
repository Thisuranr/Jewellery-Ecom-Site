import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import localFont from "next/font/local"
import "styles/globals.css"

// Self-hosted via @fontsource (no network at build time).
const cormorant = localFont({
  variable: "--font-cormorant",
  display: "swap",
  src: [
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
})

const jost = localFont({
  variable: "--font-jost",
  display: "swap",
  src: [
    {
      path: "../../node_modules/@fontsource/jost/files/jost-latin-300-normal.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/jost/files/jost-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/jost/files/jost-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
  ],
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" className={`${cormorant.variable} ${jost.variable}`}>
      <head>
        {process.env.UCP_ENABLED === "true" ? <link rel="ucp" href="/.well-known/ucp" /> : null}
      </head>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
