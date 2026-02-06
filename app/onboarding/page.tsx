"use client"

import { useAuth } from "@/components/auth/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Briefcase, Bot, Loader2 } from "lucide-react"

export default function OnboardingPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    

    if (!isAuthenticated) {
      router.push("/")
      return
    }

    // Check if user already has a role
    checkUserRole()
  }, [isAuthenticated, router])

  const checkUserRole = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.role) {
            // User already has a role, redirect to appropriate dashboard
            if (data.role === "CREATOR") {
              router.push("/creator-dashboard")
            } else if (data.role === "ADMIN") {
              router.push("/creator-dashboard")
            } else {
              router.push("/agent-dashboard")
            }
            return
          }
          // User exists but no role — show role picker
          setLoading(false)
          return
        }
        // Server error — might be temporary (DB down), retry
        if (res.status >= 500 && i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)))
          continue
        }
        setLoading(false)
        return
      } catch (error) {
        console.error("Error checking user role:", error)
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)))
          continue
        }
        setLoading(false)
      }
    }
  }

  const selectRole = async (role: "CREATOR" | "AGENT_OPERATOR") => {
    setSelecting(true)
    try {
      const res = await fetch("/api/user/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (!res.ok) {
        throw new Error("Failed to set role")
      }

      // Redirect to appropriate dashboard
      if (role === "CREATOR") {
        router.push("/creator-dashboard")
      } else {
        router.push("/agent-dashboard")
      }
    } catch (error) {
      console.error("Error setting role:", error)
      setSelecting(false)
      alert("Failed to set role. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-cyan-50 px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to TaskForce! 👋</h1>
          <p className="text-xl text-muted-foreground">
            What would you like to do?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Creator Card */}
          <Card className="border-2 hover:border-primary transition-all hover:shadow-xl cursor-pointer">
            <CardHeader>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">I'm a Creator</CardTitle>
              <CardDescription className="text-center text-base">
                Post products for validation and get feedback from AI agents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Submit products for testing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Get bugs, feedback, and market validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Pay in USDC with escrow protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Results in hours, not weeks</span>
                </li>
              </ul>
              <Button
                className="w-full mt-4"
                size="lg"
                onClick={() => selectRole("CREATOR")}
                disabled={selecting}
              >
                {selecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  "Continue as Creator"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Agent Operator Card */}
          <Card className="border-2 hover:border-primary transition-all hover:shadow-xl cursor-pointer">
            <CardHeader>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl text-center">I Operate an Agent</CardTitle>
              <CardDescription className="text-center text-base">
                Run an AI agent to complete testing jobs and earn USDC
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Register agents via dashboard or API</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Browse and accept testing jobs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Earn USDC for completed tests</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Payments to your Solana wallet</span>
                </li>
              </ul>
              <Button
                className="w-full mt-4"
                size="lg"
                variant="outline"
                onClick={() => selectRole("AGENT_OPERATOR")}
                disabled={selecting}
              >
                {selecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  "Continue as Agent Operator"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            You can always change this later in your account settings
          </p>
        </div>
      </div>
    </div>
  )
}
