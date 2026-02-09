import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TaskStatusBadge } from "@/components/task/task-status-badge"
import { CategoryBadge } from "@/components/task/category-badge"
import { TaskMessages } from "@/components/task/task-messages"
import { TaskPaymentWrapper } from "@/components/task/task-payment-wrapper"
import { DeleteTaskButton } from "@/components/task/delete-task-button"
import { ApplicationActions } from "@/components/task/application-actions"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Calendar, DollarSign, Users, FileText, ExternalLink, Key, Clock, Pencil } from "lucide-react"
import { format } from "date-fns"

export default async function TaskDetailsPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = await params
  const session = await requireAuth()

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    include: {
      applications: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              reputation: true,
              completedTests: true,
              totalEarnings: true,
              averageRating: true,
              operatorId: true,
            }
          }
        },
        orderBy: { appliedAt: 'desc' }
      },
      submissions: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      },
      _count: {
        select: {
          applications: true,
          submissions: true
        }
      }
    },
    // Include escrow wallet fields
  })

  if (!task) {
    notFound()
  }

  // If user is not the creator, redirect to worker view
  if (task.creatorId !== session.user.id) {
    redirect(`/browse/${taskId}`)
  }

  const payment = task.paymentPerWorker ?? task.totalBudget
  const slotsRemaining = task.maxWorkers - task.currentWorkers
  const acceptedApplications = task.applications.filter(app => app.status === 'ACCEPTED')
  const pendingApplications = task.applications.filter(app => app.status === 'PENDING')
  const submittedCount = task.submissions.filter(sub => sub.status === 'SUBMITTED').length
  
  // Check if current user is a participant (creator or any applicant)
  const isCreator = task.creatorId === session.user.id
  const isApplicant = task.applications.some(app => app.agent.operatorId === session.user.id)
  const isParticipant = isCreator || isApplicant
  const showMessages = isParticipant && task.status !== 'DRAFT'

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <TaskStatusBadge status={task.status as any} />
              <CategoryBadge category={task.category} />
              {task.status === 'DRAFT' && (
                <Badge variant="outline" className="text-warning">
                  Awaiting Payment
                </Badge>
              )}
            </div>
          </div>
          {submittedCount > 0 && (
            <Button asChild>
              <Link href={`/tasks/${task.id}/submissions`}>
                Review Submissions ({submittedCount})
              </Link>
            </Button>
          )}
        </div>

        {/* Pending Submissions Banner */}
        {submittedCount > 0 && (
          <Card className="border-orange-500/50 bg-orange-500/5 mb-6">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Action Required</p>
                  <p className="text-sm text-muted-foreground">
                    You have {submittedCount} pending submission{submittedCount > 1 ? 's' : ''} awaiting review.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link href={`/tasks/${task.id}/submissions`}>
                  Review Now
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle>Task Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {task.requirements}
                </p>
              </CardContent>
            </Card>

            {/* Reference & Credentials */}
            <Card>
              <CardHeader>
                <CardTitle>Task Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.referenceUrl && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Reference URL
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={task.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {task.referenceUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {task.credentials && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      Credentials
                    </label>
                    <div className="mt-1 rounded-lg bg-muted p-3 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">{task.credentials}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only visible to accepted workers
                    </p>
                  </div>
                )}

                {task.skillsRequired && task.skillsRequired.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Skills Required
                    </label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {task.skillsRequired.map((skill, idx) => (
                        <Badge key={idx} variant="outline">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Applications */}
            {task.applications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Applications ({task.applications.length})</CardTitle>
                  <CardDescription>
                    Workers who have applied for this task
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {task.applications.map((application) => (
                      <div
                        key={application.id}
                        className={`p-3 rounded-lg border space-y-2 ${
                          application.status === 'ACCEPTED' ? 'border-green-300 bg-green-50/50' :
                          application.status === 'REJECTED' ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <Link href={`/agents/${application.agent.id}`} className="font-medium hover:underline">
                                {application.agent.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                ⭐ {application.agent.reputation.toFixed(1)} |
                                Completed: {application.agent.completedTests} |
                                Earned: ${application.agent.totalEarnings.toFixed(0)}
                                {application.agent.averageRating != null && ` | Avg Rating: ${application.agent.averageRating.toFixed(1)}`}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Applied {format(new Date(application.appliedAt), "MMM d, yyyy 'at' h:mm a")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {application.status === 'PENDING' && (
                              <ApplicationActions
                                taskId={task.id}
                                applicationId={application.id}
                              />
                            )}
                            <Badge
                              variant={
                                application.status === 'ACCEPTED' ? 'default' :
                                application.status === 'REJECTED' ? 'destructive' :
                                'secondary'
                              }
                              className={application.status === 'ACCEPTED' ? 'bg-green-600' : ''}
                            >
                              {application.status}
                            </Badge>
                          </div>
                        </div>
                        {application.message && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm italic border-l-2 border-primary">
                            &quot;{application.message}&quot;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Messages */}
            {showMessages && (
              <TaskMessages 
                taskId={task.id}
                currentUserId={session.user.id}
                isParticipant={isParticipant}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Payment per worker
                  </span>
                  <span className="font-semibold">${payment}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Slots
                  </span>
                  <span className="font-semibold">
                    {task.currentWorkers} / {task.maxWorkers}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Remaining
                  </span>
                  <span className={slotsRemaining <= 2 ? "text-warning font-semibold" : "font-semibold"}>
                    {slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''}
                  </span>
                </div>

                <Separator />

                {task.deadline && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Deadline
                      </span>
                      <span className="font-semibold text-sm">
                        {format(new Date(task.deadline), "MMM d, yyyy")}
                      </span>
                    </div>
                    <Separator />
                  </>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Applications
                  </span>
                  <span className="font-semibold">{task._count.applications}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Submissions
                  </span>
                  <span className="font-semibold">{task._count.submissions}</span>
                </div>

                <Separator />

                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-1">Total Budget</div>
                  <div className="text-2xl font-bold text-primary">
                    ${task.totalBudget.toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">USDC</span>
                  </div>
                </div>

                {task.escrowWalletAddress && task.status !== 'DRAFT' && (
                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground mb-1">Escrow Wallet</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-muted-foreground truncate max-w-[180px]">
                        {task.escrowWalletAddress}
                      </code>
                      <a
                        href={`https://solscan.io/account/${task.escrowWalletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        View on Solscan ↗
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">Created</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(task.createdAt), "PPpp")}
                    </div>
                  </div>
                </div>

                {task.completedAt && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-success mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">Completed</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(task.completedAt), "PPpp")}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions — Full Width Below */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.status === 'DRAFT' && (
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    Send <span className="font-semibold">${task.totalBudget.toFixed(2)} USDC</span> to the task escrow wallet to activate this task.
                  </p>
                  <TaskPaymentWrapper 
                    taskId={task.id} 
                    totalBudget={task.totalBudget}
                    escrowWalletAddress={task.escrowWalletAddress}
                  />
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Button variant="outline" asChild>
                      <Link href={`/tasks/${task.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Task
                      </Link>
                    </Button>
                    <DeleteTaskButton
                      taskId={task.id}
                      taskStatus={task.status}
                      hasWorkers={task.currentWorkers > 0}
                      hasSubmissions={task.submissions.length > 0}
                    />
                  </div>
                </div>
              )}

              {['ACTIVE', 'IN_PROGRESS'].includes(task.status) && (
                <div className="flex flex-wrap gap-3">
                  {submittedCount > 0 && (
                    <Button asChild>
                      <Link href={`/tasks/${task.id}/submissions`}>
                        Review Submissions ({submittedCount})
                      </Link>
                    </Button>
                  )}
                  {task.status !== 'COMPLETED' && (
                    <Button variant="outline" asChild>
                      <Link href={`/tasks/${task.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Task
                      </Link>
                    </Button>
                  )}
                  <DeleteTaskButton
                    taskId={task.id}
                    taskStatus={task.status}
                    hasWorkers={task.currentWorkers > 0}
                    hasSubmissions={task.submissions.length > 0}
                  />
                </div>
              )}

              {task.status === 'COMPLETED' && (
                <p className="text-muted-foreground">This task has been completed.</p>
              )}

              {task.status === 'CANCELLED' && (
                <p className="text-muted-foreground">This task has been cancelled.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
