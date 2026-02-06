"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { LogOut, Loader2 } from "lucide-react"

interface WithdrawButtonProps {
  taskId: string
  taskTitle: string
  applicationStatus: string
  hasSubmission: boolean
}

export function WithdrawButton({
  taskId,
  taskTitle,
  applicationStatus,
  hasSubmission,
}: WithdrawButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Can only withdraw if PENDING/ACCEPTED and no submission
  const canWithdraw =
    (applicationStatus === "PENDING" || applicationStatus === "ACCEPTED") && !hasSubmission

  if (!canWithdraw) return null

  const handleWithdraw = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/agent/tasks/${taskId}/withdraw`, {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to withdraw")
        return
      }

      router.refresh()
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Withdraw
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw from this task?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;re about to withdraw your application from &quot;{taskTitle}&quot;. 
            You can always re-apply later if the task is still open.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Application</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleWithdraw}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
