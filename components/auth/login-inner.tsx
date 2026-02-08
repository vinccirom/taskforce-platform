"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets } from "@privy-io/react-auth/solana"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LoginInner() {
  const { login, logout, ready, authenticated, user } = usePrivy()
  const { wallets: solanaWallets } = useWallets()
  const router = useRouter()
  const loginOpened = useRef(false)
  const redirected = useRef(false)
  const [waitingForWallets, setWaitingForWallets] = useState(false)

  useEffect(() => {
    if (!ready) return

    if (authenticated) {
      // Check if the privy-token cookie actually exists
      const hasCookie = document.cookie.includes("privy-token")
      if (!hasCookie) {
        logout().then(() => {
          loginOpened.current = false
        })
        return
      }

      // Wait for embedded wallets to be created before redirecting
      const hasLinkedWallets = user?.linkedAccounts?.some(
        (a: any) => a.type === 'wallet'
      )

      if (!hasLinkedWallets && !waitingForWallets) {
        // Wallets not ready yet — wait
        setWaitingForWallets(true)
        return
      }

      if (!hasLinkedWallets && waitingForWallets) {
        // Still waiting — Privy's createOnLogin hasn't finished
        // Set a timeout fallback so we don't wait forever
        const timer = setTimeout(() => {
          if (!redirected.current) {
            redirected.current = true
            window.location.href = "/creator-dashboard"
          }
        }, 5000)
        return () => clearTimeout(timer)
      }

      // Wallets are ready — redirect
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
  }, [ready, authenticated, login, logout, user, solanaWallets, waitingForWallets])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground mb-6">
          {waitingForWallets ? "Setting up your wallets..." : "Loading authentication..."}
        </p>
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
