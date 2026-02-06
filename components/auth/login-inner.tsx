"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LoginInner() {
  const { login, logout, ready, authenticated } = usePrivy()
  const router = useRouter()
  const loginOpened = useRef(false)
  const redirected = useRef(false)

  useEffect(() => {
    if (!ready) return

    if (authenticated) {
      // Check if the privy-token cookie actually exists
      const hasCookie = document.cookie.includes("privy-token")
      if (!hasCookie) {
        // Privy SDK thinks we're authenticated but cookie is gone (expired/cleared)
        // Logout from Privy to reset the stale client state, then re-prompt login
        logout().then(() => {
          loginOpened.current = false
        })
        return
      }

      // Truly authenticated with a valid cookie — go to dashboard
      if (!redirected.current) {
        redirected.current = true
        window.location.href = "/creator-dashboard"
      }
      return
    }

    // Not authenticated — open the login modal once
    if (!loginOpened.current) {
      loginOpened.current = true
      login()
    }
  }, [ready, authenticated, login, logout])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground mb-6">Loading authentication...</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => { loginOpened.current = false; login() }}>
            Open Login
          </Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
