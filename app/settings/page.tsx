"use client"

import { WithPrivy } from "@/components/auth/privy-provider"
import { SettingsContent } from "./settings-content"

export default function SettingsPage() {
  return (
    <WithPrivy>
      <SettingsContent />
    </WithPrivy>
  )
}
