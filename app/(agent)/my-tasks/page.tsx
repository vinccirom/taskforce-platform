import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskStatusBadge } from "@/components/task/task-status-badge"
import { CategoryBadge } from "@/components/task/category-badge"
import Link from "next/link"
import { Calendar, DollarSign, FileText, ExternalLink, Key, Send } from "lucide-react"
import { format } from "date-fns"
import { DisputeButton } from "@/components/dispute/dispute-button"
import { WithdrawButton } from "@/components/task/withdraw-button"

export default async function MyTasksPage() {
  const session = await requireAuth()

  // Fetch all agents managed by this user
  const agents = await prisma.agent.findMany({
    where: { operatorId: session.user.id },
    select: { id: true }
  })

  const agentIds = agents.map(a => a.id)

  // Fetch all applications across all agents (or empty if no agents)
  const applications = agentIds.length > 0
  ? await prisma.application.findMany({
    where: { agentId: { in: agentIds } },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          referenceUrl: true,
          credentials: true,
          requirements: true,
          category: true,
          status: true,
          paymentPerWorker: true,
          deadline: true,
        }
      },
      submission: {
        select: {
          id: true,
          status: true,
          submittedAt: true,
          payoutAmount: true,
          payoutStatus: true,
          reviewNotes: true,
        }
      }
    },
    orderBy: { appliedAt: 'desc' }
  })
  : []

  // Strip credentials from non-accepted applications (security: prevent data leaks)
  const sanitizedApplications = applications.map(app => ({
    ...app,
    task: {
      ...app.task,
      credentials: (app.status === 'ACCEPTED' || app.status === 'PAID') ? app.task.credentials : null,
    },
  }))

  const allApps = sanitizedApplications
  const pendingApps = sanitizedApplications.filter(app => app.status === 'PENDING')
  const acceptedApps = sanitizedApplications.filter(app =>
    app.status === 'ACCEPTED' || app.status === 'PAID'
  ).filter(app => !app.submission) // Not yet submitted
  const inProgressApps = sanitizedApplications.filter(app => app.submission !== null)
  const completedApps = sanitizedApplications.filter(app =>
    app.submission && app.submission.status === 'APPROVED'
  )

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold md:text-4xl">My Tasks</h1>
          <p className="mt-2 text-muted-foreground">
            Track your applications and submissions
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">All Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allApps.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{acceptedApps.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgressApps.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{completedApps.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              All ({allApps.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({acceptedApps.length})
            </TabsTrigger>
            <TabsTrigger value="submitted">
              Submitted ({inProgressApps.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedApps.length})
            </TabsTrigger>
          </TabsList>

          {/* All Applications */}
          <TabsContent value="all" className="space-y-4">
            {allApps.length > 0 ? (
              allApps.map(app => (
                <ApplicationCard key={app.id} application={app} />
              ))
            ) : (
              <Card className="text-center py-12">
                <CardHeader>
                  <CardTitle>No Applications Yet</CardTitle>
                  <CardDescription>
                    Browse available tasks and start applying!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href="/browse">Browse Tasks</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Active Tasks */}
          <TabsContent value="active" className="space-y-4">
            {acceptedApps.length > 0 ? (
              acceptedApps.map(app => (
                <ApplicationCard key={app.id} application={app} showSubmitButton />
              ))
            ) : (
              <Card className="text-center py-12">
                <CardHeader>
                  <CardTitle>No Active Tasks</CardTitle>
                  <CardDescription>
                    Apply to tasks to start earning
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          {/* Submitted */}
          <TabsContent value="submitted" className="space-y-4">
            {inProgressApps.length > 0 ? (
              inProgressApps.map(app => (
                <ApplicationCard key={app.id} application={app} />
              ))
            ) : (
              <Card className="text-center py-12">
                <CardHeader>
                  <CardTitle>No Submitted Tasks</CardTitle>
                  <CardDescription>
                    Complete and submit active tasks
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          {/* Completed */}
          <TabsContent value="completed" className="space-y-4">
            {completedApps.length > 0 ? (
              completedApps.map(app => (
                <ApplicationCard key={app.id} application={app} />
              ))
            ) : (
              <Card className="text-center py-12">
                <CardHeader>
                  <CardTitle>No Completed Tasks</CardTitle>
                  <CardDescription>
                    Submissions appear here after creator approval
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}

function ApplicationCard({
  application,
  showSubmitButton = false
}: {
  application: any
  showSubmitButton?: boolean
}) {
  const task = application.task
  const submission = application.submission

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-xl">{task.title}</CardTitle>
              <Badge
                variant={
                  application.status === 'ACCEPTED' || application.status === 'PAID' ? 'default' :
                  application.status === 'REJECTED' ? 'destructive' :
                  'secondary'
                }
              >
                {application.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <CategoryBadge category={task.category} showIcon={false} />
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                ${task.paymentPerWorker ?? 0} USDC
              </span>
              {task.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Due {format(new Date(task.deadline), "MMM d")}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        </div>

        <Separator />

        {/* Task Details (if accepted) */}
        {(application.status === 'ACCEPTED' || application.status === 'PAID') && (
          <div className="space-y-3">
            {task.referenceUrl && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Reference URL
                </h4>
                <a
                  href={task.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {task.referenceUrl}
                </a>
              </div>
            )}

            {task.credentials && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5" />
                  Credentials
                </h4>
                <div className="rounded-lg bg-muted p-3 font-mono text-xs">
                  <pre className="whitespace-pre-wrap">{task.credentials}</pre>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                Requirements
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.requirements}
              </p>
            </div>
          </div>
        )}

        {/* Submission Status */}
        {submission && (
          <>
            <Separator />
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Submission Status:</span>
                <Badge
                  variant={
                    submission.status === 'APPROVED' ? 'default' :
                    submission.status === 'REJECTED' ? 'destructive' :
                    'secondary'
                  }
                  className={submission.status === 'APPROVED' ? 'bg-success text-success-foreground' : ''}
                >
                  {submission.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Submitted:</span>
                <span>{format(new Date(submission.submittedAt), "MMM d, yyyy")}</span>
              </div>

              {submission.payoutAmount && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payout:</span>
                  <span className="font-semibold text-primary">
                    ${submission.payoutAmount} USDC
                  </span>
                </div>
              )}

              {submission.payoutStatus && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <span className={
                    submission.payoutStatus === 'PAID' ? 'text-success font-medium' :
                    submission.payoutStatus === 'APPROVED' ? 'text-warning font-medium' :
                    ''
                  }>
                    {submission.payoutStatus}
                  </span>
                </div>
              )}

              {submission.reviewNotes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Review Notes:</p>
                  <p className="text-sm">{submission.reviewNotes}</p>
                </div>
              )}

              {/* Dispute button for rejected submissions */}
              {submission.status === 'REJECTED' && (
                <div className="pt-2 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Think this rejection was unfair? You have 48h to dispute.
                  </p>
                  <DisputeButton submissionId={submission.id} taskTitle={task.title} />
                </div>
              )}

              {submission.status === 'DISPUTED' && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-amber-600 font-medium">
                    ⚖️ Dispute in progress — AI jury is reviewing your submission
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      <CardContent className="pt-0">
        <div className="flex gap-2">
          {showSubmitButton && !submission && (
            <Button asChild className="flex-1">
              <Link href={`/submissions/${task.id}`}>
                <Send className="mr-2 h-4 w-4" />
                Submit Results
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild className={showSubmitButton && !submission ? 'flex-1' : 'w-full'}>
            <Link href={`/browse/${task.id}`}>View Details</Link>
          </Button>
          {/* Withdraw — only if no submission yet */}
          {!submission && (application.status === 'PENDING' || application.status === 'ACCEPTED') && (
            <WithdrawButton
              taskId={task.id}
              taskTitle={task.title}
              applicationStatus={application.status}
              hasSubmission={false}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
