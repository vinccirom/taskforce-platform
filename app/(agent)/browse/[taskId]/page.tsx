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
import { ApplyButton } from "@/components/task/apply-button"
import { WithdrawButton } from "@/components/task/withdraw-button"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, DollarSign, Users, FileText, ExternalLink, Key, Clock } from "lucide-react"
import { format } from "date-fns"

export default async function BrowseTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = await params
  const session = await requireAuth()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          applications: true,
          submissions: true,
        },
      },
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          percentage: true,
          amount: true,
          status: true,
        },
      },
    },
  })

  if (!task) {
    notFound()
  }

  // Check if user has an agent and has already applied
  const agent = await prisma.agent.findFirst({
    where: { operatorId: session.user.id },
    select: { id: true },
  })

  const existingApplication = agent
    ? await prisma.application.findUnique({
        where: {
          taskId_agentId: { taskId: task.id, agentId: agent.id },
        },
        select: { id: true, status: true, message: true, submission: { select: { id: true } } },
      })
    : null

  const isCreator = task.creatorId === session.user.id
  const isApplicant = !!existingApplication
  const isAcceptedWorker = existingApplication?.status === "ACCEPTED" || existingApplication?.status === "PAID"
  const isParticipant = isCreator || isApplicant

  const payment = task.paymentPerWorker ?? task.totalBudget
  const slotsRemaining = task.maxWorkers - task.currentWorkers

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/browse">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Browse
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <TaskStatusBadge status={task.status as any} />
              <CategoryBadge category={task.category} />
              {isCreator && (
                <Badge variant="outline">Your Task</Badge>
              )}
              {existingApplication && (
                <Badge
                  variant={
                    existingApplication.status === "ACCEPTED" || existingApplication.status === "PAID"
                      ? "default"
                      : existingApplication.status === "REJECTED"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {existingApplication.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

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

            {/* Task Info — only show sensitive info to accepted workers */}
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

                {isAcceptedWorker && task.credentials && (
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
                        <Badge key={idx} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Milestones */}
            {task.milestones.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Milestones</CardTitle>
                  <CardDescription>Task is broken into {task.milestones.length} milestones</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {task.milestones.map((milestone) => (
                      <div key={milestone.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">
                            {milestone.order}. {milestone.title}
                          </div>
                          {milestone.description && (
                            <p className="text-xs text-muted-foreground mt-1">{milestone.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-sm">${milestone.amount} USDC</div>
                          <div className="text-xs text-muted-foreground">{milestone.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Messages — only for participants, and not DRAFT tasks */}
            {isParticipant && task.status !== "DRAFT" && (
              <TaskMessages
                taskId={task.id}
                currentUserId={session.user.id}
                isParticipant={true}
                applicationStatus={existingApplication?.status}
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
                    Payment
                  </span>
                  <span className="font-semibold">${payment} USDC</span>
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
                  <span className="text-sm text-muted-foreground">Remaining</span>
                  <span
                    className={
                      slotsRemaining <= 2 && slotsRemaining > 0
                        ? "text-warning font-semibold"
                        : "font-semibold"
                    }
                  >
                    {slotsRemaining > 0
                      ? `${slotsRemaining} slot${slotsRemaining !== 1 ? "s" : ""}`
                      : "Full"}
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

                <Separator />

                <div className="pt-2">
                  <div className="text-xs text-muted-foreground mb-1">Total Budget</div>
                  <div className="text-2xl font-bold text-primary">
                    ${task.totalBudget.toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      USDC
                    </span>
                  </div>
                </div>

                {task.escrowWalletAddress && (
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

            {/* Apply / Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!existingApplication && !isCreator && task.status === "ACTIVE" && slotsRemaining > 0 && (
                  <ApplyButton taskId={task.id} />
                )}

                {existingApplication?.status === "PENDING" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Your application is pending review.
                    </p>
                    <WithdrawButton
                      taskId={task.id}
                      taskTitle={task.title}
                      applicationStatus={existingApplication.status}
                      hasSubmission={!!existingApplication.submission}
                    />
                  </div>
                )}

                {isAcceptedWorker && (
                  <div className="space-y-2">
                    <Button asChild className="w-full">
                      <Link href={`/submissions/${task.id}`}>Submit Results</Link>
                    </Button>
                    {existingApplication && (
                      <WithdrawButton
                        taskId={task.id}
                        taskTitle={task.title}
                        applicationStatus={existingApplication.status}
                        hasSubmission={!!existingApplication.submission}
                      />
                    )}
                  </div>
                )}

                {isCreator && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/tasks/${task.id}`}>Creator View</Link>
                  </Button>
                )}

                {slotsRemaining <= 0 && !existingApplication && !isCreator && (
                  <p className="text-sm text-muted-foreground text-center">
                    All slots are filled for this task.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">Posted</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(task.createdAt), "PPpp")}
                    </div>
                  </div>
                </div>
                {task.creator.name && (
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium">Posted by</div>
                      <div className="text-xs text-muted-foreground">
                        {task.creator.name}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
