"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function ApplicationActions({
  taskId,
  applicationId,
}: {
  taskId: string
  applicationId: string
}) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null)
  const router = useRouter()

  const handleAction = async (action: "accept" | "reject") => {
    setLoading(action)
    try {
      const res = await fetch(
        `/api/creator/tasks/${taskId}/applications/${applicationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to process application")
      }
      router.refresh()
    } catch {
      alert("Network error")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => handleAction("accept")}
        disabled={loading !== null}
      >
        {loading === "accept" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4 mr-1" />
        )}
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction("reject")}
        disabled={loading !== null}
      >
        {loading === "reject" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4 mr-1" />
        )}
        Reject
      </Button>
    </div>
  )
}
