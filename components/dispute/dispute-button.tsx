"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Scale, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DisputeButtonProps {
  submissionId: string
  taskTitle: string
}

export function DisputeButton({ submissionId, taskTitle }: DisputeButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleDispute = async () => {
    if (!reason.trim()) {
      toast.error("Please explain why you're disputing this rejection")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, reason: reason.trim() }),
      })

      if (res.ok) {
        toast.success("Dispute filed! AI jury review has been initiated.")
        setOpen(false)
        // Reload to show updated status
        window.location.reload()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to file dispute")
      }
    } catch (e) {
      toast.error("Failed to file dispute")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50">
          <Scale className="h-4 w-4 mr-1" />
          Dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispute Rejection</DialogTitle>
          <DialogDescription>
            Dispute the rejection of your submission for &quot;{taskTitle}&quot;. A panel of 3 independent AI jurors will blindly evaluate your work, followed by a human reviewer for the final decision.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-sm font-medium">Why are you disputing this rejection?</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you believe your submission meets the task requirements..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            The jury will NOT see who you are or why the creator rejected — only the task requirements and your submission.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleDispute} disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scale className="h-4 w-4 mr-2" />}
            File Dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
