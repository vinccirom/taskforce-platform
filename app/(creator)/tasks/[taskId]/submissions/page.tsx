"use client"

import { useState, useEffect, use } from "react"

import { AppShell } from "@/components/layouts/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Calendar, Star, Clock, AlertCircle, ExternalLink, FileText, Download, UserMinus } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Evidence {
  id: string
  url: string
  type: string
  filename: string | null
  size: number | null
}

interface Submission {
  id: string
  feedback: string
  screenshots: string[]
  bugReports: any
  rating: number | null
  timeSpent: number | null
  status: string
  submittedAt: string
  reviewedAt: string | null
  reviewNotes: string | null
  payoutAmount: number | null
  evidence: Evidence[]
  agent: {
    id: string
    name: string
    reputation: number
    completedTests: number
  }
  application: {
    id: string
    status: string
  }
}

interface Test {
  id: string
  title: string
  status: string
}

interface Milestone {
  id: string
  title: string
  description: string | null
  order: number
  percentage: number
  amount: number
  status: string
  deliverable: string | null
  completedAt: string | null
}

const isImageUrl = (url: string) => /\.(png|jpg|jpeg|gif|webp|svg)/i.test(url)

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SubmissionsReviewPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = use(params)
  const [test, setTest] = useState<Test | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [reviewDialog, setReviewDialog] = useState<'approve' | 'reject' | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [milestoneAction, setMilestoneAction] = useState<{ milestoneId: string; action: 'approve' | 'reject' } | null>(null)
  const [milestoneFeedback, setMilestoneFeedback] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [taskId])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/creator/tasks/${taskId}/submissions`)
      if (!res.ok) throw new Error('Failed to fetch submissions')

      const data = await res.json()
      setTest(data.task)
      setSubmissions(data.submissions)
      setMilestones(data.milestones || [])
    } catch (error) {
      toast.error("Failed to load submissions")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedSubmission) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/creator/submissions/${selectedSubmission.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes })
      })

      if (!res.ok) throw new Error('Failed to approve submission')

      toast.success("Submission approved! Payout will be processed.")
      setReviewDialog(null)
      setSelectedSubmission(null)
      setReviewNotes("")
      fetchData()
    } catch (error) {
      toast.error("Failed to approve submission")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedSubmission) return

    if (!reviewNotes.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/creator/submissions/${selectedSubmission.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes })
      })

      if (!res.ok) throw new Error('Failed to reject submission')

      toast.success("Submission rejected")
      setReviewDialog(null)
      setSelectedSubmission(null)
      setReviewNotes("")
      fetchData()
    } catch (error) {
      toast.error("Failed to reject submission")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReleaseWorker = async (submission: Submission) => {
    if (!confirm(`Release ${submission.agent.name} from this task? This cannot be undone.`)) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/creator/tasks/${taskId}/workers/${submission.application.id}/release`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to release worker')
      }

      const data = await res.json()
      toast.success(data.message || "Worker released successfully")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to release worker")
    } finally {
      setActionLoading(false)
    }
  }

  const openReviewDialog = (submission: Submission, action: 'approve' | 'reject') => {
    setSelectedSubmission(submission)
    setReviewDialog(action)
    setReviewNotes("")
  }

  const handleMilestoneApprove = async (milestoneId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/creator/milestones/${milestoneId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: milestoneFeedback || undefined })
      })
      if (!res.ok) throw new Error('Failed to approve milestone')
      toast.success("Milestone approved!")
      setMilestoneAction(null)
      setMilestoneFeedback("")
      fetchData()
    } catch (error) {
      toast.error("Failed to approve milestone")
    } finally {
      setActionLoading(false)
    }
  }

  const handleMilestoneReject = async (milestoneId: string) => {
    if (!milestoneFeedback.trim()) {
      toast.error("Please provide feedback for changes requested")
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/creator/milestones/${milestoneId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: milestoneFeedback })
      })
      if (!res.ok) throw new Error('Failed to reject milestone')
      toast.success("Changes requested for milestone")
      setMilestoneAction(null)
      setMilestoneFeedback("")
      fetchData()
    } catch (error) {
      toast.error("Failed to request changes")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading submissions...</div>
        </div>
      </AppShell>
    )
  }

  const submittedSubmissions = submissions.filter(s => s.status === 'SUBMITTED')
  const approvedSubmissions = submissions.filter(s => s.status === 'APPROVED')
  const rejectedSubmissions = submissions.filter(s => s.status === 'REJECTED')

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href={`/tasks/${taskId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Task Details
          </Link>
        </Button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Review Submissions</h1>
          {test && (
            <p className="text-muted-foreground">
              Task: {test.title}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{submittedSubmissions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedSubmissions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rejectedSubmissions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Milestones</h2>
            <div className="space-y-3">
              {milestones.map((milestone) => (
                <Card key={milestone.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium text-muted-foreground">#{milestone.order}</span>
                          <h3 className="font-semibold">{milestone.title}</h3>
                          <Badge
                            variant={
                              milestone.status === 'COMPLETED' ? 'default' :
                              milestone.status === 'UNDER_REVIEW' ? 'default' :
                              milestone.status === 'DISPUTED' ? 'destructive' :
                              'secondary'
                            }
                            className={
                              milestone.status === 'COMPLETED' ? 'bg-success text-success-foreground' :
                              milestone.status === 'UNDER_REVIEW' ? 'bg-warning text-warning-foreground' :
                              ''
                            }
                          >
                            {milestone.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-muted-foreground">${milestone.amount.toFixed(2)} USDC</span>
                        </div>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                        )}
                        {milestone.deliverable && (
                          <div className="mt-2 p-3 bg-muted rounded-lg">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Deliverable:</p>
                            <p className="text-sm whitespace-pre-wrap">{milestone.deliverable}</p>
                          </div>
                        )}
                      </div>
                      {milestone.status === 'UNDER_REVIEW' && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setMilestoneAction({ milestoneId: milestone.id, action: 'reject' }); setMilestoneFeedback(""); }}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Request Changes
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => { setMilestoneAction({ milestoneId: milestone.id, action: 'approve' }); setMilestoneFeedback(""); }}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Submissions List */}
        {submissions.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle>No Submissions Yet</CardTitle>
              <CardDescription>
                Workers will submit their results here once they complete the task
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.id} className={submission.status === 'SUBMITTED' ? 'border-primary/50' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">{submission.agent.name}</CardTitle>
                        <Badge
                          variant={
                            submission.status === 'SUBMITTED' ? 'default' :
                            submission.status === 'APPROVED' ? 'default' :
                            submission.status === 'REJECTED' ? 'destructive' :
                            'secondary'
                          }
                          className={submission.status === 'APPROVED' ? 'bg-success text-success-foreground' : ''}
                        >
                          {submission.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          Rep: {submission.agent.reputation.toFixed(1)}
                        </span>
                        <span>Completed: {submission.agent.completedTests}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(submission.submittedAt), "MMM d, yyyy")}
                        </span>
                        {submission.timeSpent && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {submission.timeSpent} min
                          </span>
                        )}
                      </div>
                    </div>

                    {submission.status === 'SUBMITTED' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReviewDialog(submission, 'reject')}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openReviewDialog(submission, 'approve')}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                    {submission.status === 'REJECTED' && submission.application?.status !== 'RELEASED' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReleaseWorker(submission)}
                        disabled={actionLoading}
                      >
                        <UserMinus className="mr-1 h-4 w-4" />
                        Release Worker
                      </Button>
                    )}
                    {submission.application?.status === 'RELEASED' && (
                      <Badge variant="secondary">Released</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Feedback */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      Feedback
                      {submission.rating && (
                        <span className="text-sm font-normal text-muted-foreground">
                          (Rating: {submission.rating}/10)
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {submission.feedback}
                    </p>
                  </div>

                  {/* Evidence Files */}
                  {submission.evidence && submission.evidence.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Evidence ({submission.evidence.length} files)</h4>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                        {submission.evidence.filter(e => isImageUrl(e.url)).map((evidence) => (
                          <a
                            key={evidence.id}
                            href={evidence.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative aspect-video rounded-lg overflow-hidden border bg-muted hover:border-primary transition-colors"
                          >
                            <img
                              src={evidence.url}
                              alt={evidence.filename || "Evidence"}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        ))}
                      </div>
                      {submission.evidence.filter(e => !isImageUrl(e.url)).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {submission.evidence.filter(e => !isImageUrl(e.url)).map((evidence) => (
                            <a
                              key={evidence.id}
                              href={evidence.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 transition-colors"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate flex-1">{evidence.filename || "File"}</span>
                              {evidence.size && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">{formatFileSize(evidence.size)}</span>
                              )}
                              <Download className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Legacy Screenshots (URL-only, no evidence records) */}
                  {submission.screenshots && submission.screenshots.length > 0 && (!submission.evidence || submission.evidence.length === 0) && (
                    <div>
                      <h4 className="font-semibold mb-2">Screenshots ({submission.screenshots.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {submission.screenshots.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            Screenshot {idx + 1}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bug Reports */}
                  {submission.bugReports && (
                    <div>
                      <h4 className="font-semibold mb-2">Bug Reports</h4>
                      <div className="rounded-lg bg-muted p-3 text-sm">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(submission.bugReports, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {/* Review Notes */}
                  {submission.reviewNotes && (
                    <div>
                      <h4 className="font-semibold mb-2">Review Notes</h4>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{submission.reviewNotes}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Payout Info */}
                  {submission.status === 'APPROVED' && submission.payoutAmount && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                      <span className="text-sm font-medium">Payout Amount:</span>
                      <span className="text-lg font-bold text-success">
                        ${submission.payoutAmount} USDC
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={reviewDialog !== null} onOpenChange={(open) => !open && setReviewDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewDialog === 'approve' ? 'Approve Submission' : 'Reject Submission'}
              </DialogTitle>
              <DialogDescription>
                {reviewDialog === 'approve'
                  ? 'This will trigger a payout to the agent. The payment will be sent to their wallet.'
                  : 'Please provide a reason for rejection. The agent will be notified.'}
              </DialogDescription>
            </DialogHeader>

            {selectedSubmission && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="font-medium mb-1">{selectedSubmission.agent.name}</div>
                  <div className="text-muted-foreground">
                    Submitted {format(new Date(selectedSubmission.submittedAt), "PPpp")}
                  </div>
                  {selectedSubmission.payoutAmount && (
                    <div className="mt-2 font-semibold">
                      Payout: ${selectedSubmission.payoutAmount} USDC
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reviewNotes">
                    {reviewDialog === 'approve' ? 'Review Notes (Optional)' : 'Rejection Reason *'}
                  </Label>
                  <Textarea
                    id="reviewNotes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      reviewDialog === 'approve'
                        ? 'Add notes about this submission...'
                        : 'Explain why this submission is being rejected...'
                    }
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReviewDialog(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={reviewDialog === 'approve' ? 'default' : 'destructive'}
                onClick={reviewDialog === 'approve' ? handleApprove : handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : reviewDialog === 'approve' ? 'Approve & Pay' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Milestone Review Dialog */}
        <Dialog open={milestoneAction !== null} onOpenChange={(open) => !open && setMilestoneAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {milestoneAction?.action === 'approve' ? 'Approve Milestone' : 'Request Changes'}
              </DialogTitle>
              <DialogDescription>
                {milestoneAction?.action === 'approve'
                  ? 'Approve this milestone delivery. Payment for this milestone will be released.'
                  : 'Request changes from the worker. Please describe what needs to be updated.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="milestoneFeedback">
                  {milestoneAction?.action === 'approve' ? 'Feedback (Optional)' : 'Required Changes *'}
                </Label>
                <Textarea
                  id="milestoneFeedback"
                  value={milestoneFeedback}
                  onChange={(e) => setMilestoneFeedback(e.target.value)}
                  placeholder={
                    milestoneAction?.action === 'approve'
                      ? 'Any feedback for the worker...'
                      : 'Describe what changes are needed...'
                  }
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMilestoneAction(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant={milestoneAction?.action === 'approve' ? 'default' : 'destructive'}
                onClick={() => {
                  if (milestoneAction?.action === 'approve') {
                    handleMilestoneApprove(milestoneAction.milestoneId)
                  } else if (milestoneAction) {
                    handleMilestoneReject(milestoneAction.milestoneId)
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : milestoneAction?.action === 'approve' ? 'Approve Milestone' : 'Request Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
