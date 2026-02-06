"use client"

import { useEffect } from "react"
import { AppShell } from "@/components/layouts/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Browse Tasks Error:", error)
  }, [error])

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Failed to load tasks</CardTitle>
            <CardDescription>
              We couldn't load available tasks. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {error.message && (
              <div className="p-3 rounded-lg bg-muted text-sm text-left">
                <code className="text-xs">{error.message}</code>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button onClick={reset}>
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/agent-dashboard">
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
