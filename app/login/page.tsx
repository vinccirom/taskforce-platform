"use client"

import { WithPrivy } from "@/components/auth/privy-provider"
import { LoginInner } from "@/components/auth/login-inner"

export default function LoginPage() {
  return (
    <WithPrivy>
      <LoginInner />
    </WithPrivy>
  )
}
