"use client"

import dynamic from "next/dynamic"

// Only load Privy when explicitly needed (login, settings, wallet operations).
// This keeps the 7MB+ crypto SDK bundle off pages that don't need it.
const PrivyWrapper = dynamic(
  () => import("../privy-wrapper").then((mod) => mod.PrivyWrapper),
  { ssr: false }
)

export function WithPrivy({ children }: { children: React.ReactNode }) {
  return <PrivyWrapper>{children}</PrivyWrapper>
}
