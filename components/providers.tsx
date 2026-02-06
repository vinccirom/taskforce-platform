"use client"

import { Toaster } from "@/components/ui/sonner"
import { AuthProvider, type AuthUser } from "@/components/auth/auth-context"

export function Providers({
  user,
  children,
}: {
  user: AuthUser | null
  children: React.ReactNode
}) {
  return (
    <AuthProvider user={user}>
      {children}
      <Toaster />
    </AuthProvider>
  )
}
