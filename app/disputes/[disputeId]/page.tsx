"use client"

import { useState, useEffect, use } from "react"
import { useAuth } from "@/components/auth/auth-context"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Loader2, Scale, CheckCircle, XCircle, AlertTriangle,
  FileText, Clock, User, ThumbsUp, ThumbsDown
} from "lucide-react"

interface JuryVote {
  id: string
  jurorIndex: number
  vote: string
  reasoning: string
  confidence: number | null
  createdAt: string
}

interface DisputeDetail {
  id: string
  status: string
  reason: string
  createdAt: string
  juryStartedAt: string | null
  juryCompletedAt: string | null
  juryVerdict: string | null
  humanDecision: string | null
  humanNotes: string | null
  humanReviewedAt: string | null
  outcome: string | null
  resolvedAt: string | null
  submission: {
    id: string
    feedback: string
    deliverable: any
    screenshots: string[]
    status: string
    task: {
      id: string
      title: string
      description: string
      requirements: string
      category: string
      totalBudget: number
      paymentPerWorker: number | null
    }
    agent: { id: string; name: string }
  }
  juryVotes: JuryVote[]
}

export default function DisputeDetailPage({ params }: { params: Promise<{ disputeId: string }> }) {
  const { disputeId } = use(params)
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [dispute, setDispute] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")

  useEffect(() => {
    
    if (!isAuthenticated) { router.push("/"); return }
    fetchDispute()
  }, [isAuthenticated, disputeId])

  const fetchDispute = async () => {
    try {
      const res = await fetch(`/api/disputes/${disputeId}`)
      if (res.ok) setDispute(await res.json())
    } catch (e) {
      console.error("Failed to fetch dispute:", e)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (decision: "WORKER_PAID" | "REJECTION_UPHELD") => {
    if (!reviewNotes.trim()) {
      toast.error("Please add review notes explaining your decision")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: reviewNotes }),
      })
      if (res.ok) {
        toast.success(`Dispute resolved: ${decision === "WORKER_PAID" ? "Worker will be paid" : "Rejection upheld"}`)
        fetchDispute()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to resolve")
      }
    } catch (e) {
      toast.error("Failed to resolve dispute")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!dispute) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <p className="text-muted-foreground">Dispute not found.</p>
        </div>
      </AppShell>
    )
  }

  const { submission } = dispute
  const { task } = submission
  const workerPaidVotes = dispute.juryVotes.filter(v => v.vote === "WORKER_PAID").length
  const rejectionVotes = dispute.juryVotes.filter(v => v.vote === "REJECTION_UPHELD").length

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Scale className="h-4 w-4" />
            <span>Dispute #{dispute.id.slice(-8)}</span>
          </div>
          <h1 className="text-3xl font-bold">{task.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={
              dispute.status === "HUMAN_REVIEW" ? "bg-orange-100 text-orange-700" :
              dispute.status === "RESOLVED" ? "bg-green-100 text-green-700" :
              dispute.status === "JURY_REVIEW" ? "bg-amber-100 text-amber-700" :
              "bg-blue-100 text-blue-700"
            }>
              {dispute.status.replace("_", " ")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Filed {new Date(dispute.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Task & Submission Info */}
          <div className="space-y-6">
            {/* Task Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Task Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Category:</span>{" "}
                  <Badge variant="outline">{task.category}</Badge>
                </div>
                <div>
                  <span className="font-medium">Budget:</span> ${task.totalBudget} USDC
                </div>
                <Separator />
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
                <div>
                  <span className="font-medium">Requirements:</span>
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{task.requirements}</p>
                </div>
              </CardContent>
            </Card>

            {/* Submission */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> Submission
                </CardTitle>
                <CardDescription>By {submission.agent.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Content:</span>
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{submission.feedback}</p>
                </div>
                {submission.deliverable && (
                  <div>
                    <span className="font-medium">Deliverable:</span>
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                      {JSON.stringify(submission.deliverable, null, 2)}
                    </pre>
                  </div>
                )}
                {submission.screenshots.length > 0 && (
                  <div>
                    <span className="font-medium">Screenshots:</span> {submission.screenshots.length} attached
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Worker's Dispute Reason */}
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Worker&apos;s Dispute Reason
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{dispute.reason}</p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Jury & Resolution */}
          <div className="space-y-6">
            {/* AI Jury Votes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" /> AI Jury Verdict
                </CardTitle>
                <CardDescription>
                  {dispute.juryVotes.length === 0
                    ? "Jury review in progress..."
                    : `${workerPaidVotes} for worker, ${rejectionVotes} for rejection`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dispute.juryVotes.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI jurors are evaluating...</span>
                  </div>
                ) : (
                  <>
                    {dispute.juryVotes.map((vote) => (
                      <div key={vote.id} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Juror {vote.jurorIndex + 1}</span>
                          <div className="flex items-center gap-2">
                            {vote.confidence !== null && (
                              <span className="text-xs text-muted-foreground">
                                {(vote.confidence * 100).toFixed(0)}% conf.
                              </span>
                            )}
                            {vote.vote === "WORKER_PAID" ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" /> Pay Worker
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700">
                                <XCircle className="h-3 w-3 mr-1" /> Uphold
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{vote.reasoning}</p>
                      </div>
                    ))}

                    {dispute.juryVerdict && (
                      <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Jury Verdict:</span>
                          <Badge className={
                            dispute.juryVerdict === "WORKER_PAID"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }>
                            {dispute.juryVerdict === "WORKER_PAID" ? "Pay Worker" : "Uphold Rejection"}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Human Review Panel */}
            {dispute.status === "HUMAN_REVIEW" && (
              <Card className="border-orange-300 bg-orange-50/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" /> Your Decision
                  </CardTitle>
                  <CardDescription>
                    Review the jury&apos;s votes and make the final call. Check for any signs of manipulation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Review Notes</label>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Explain your reasoning for the final decision..."
                      rows={4}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleResolve("WORKER_PAID")}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                      Pay Worker
                    </Button>
                    <Button
                      onClick={() => handleResolve("REJECTION_UPHELD")}
                      disabled={submitting}
                      variant="destructive"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsDown className="h-4 w-4 mr-2" />}
                      Uphold Rejection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resolved */}
            {dispute.status === "RESOLVED" && (
              <Card className={dispute.outcome === "WORKER_PAID" ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30"}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Final Decision
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge className={
                    dispute.outcome === "WORKER_PAID" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }>
                    {dispute.outcome === "WORKER_PAID" ? "Worker Paid" : "Rejection Upheld"}
                  </Badge>
                  {dispute.humanNotes && (
                    <div>
                      <span className="text-sm font-medium">Reviewer Notes:</span>
                      <p className="mt-1 text-sm text-muted-foreground">{dispute.humanNotes}</p>
                    </div>
                  )}
                  {dispute.humanReviewedAt && (
                    <p className="text-xs text-muted-foreground">
                      Resolved {new Date(dispute.humanReviewedAt).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
