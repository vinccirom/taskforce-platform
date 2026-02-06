import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TaskCard } from "@/components/task/task-card"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/ui/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { Plus, FileText, Clock, CheckCircle, AlertCircle, Inbox } from "lucide-react"

export default async function CreatorDashboard() {
  const session = await requireAuth()

  // Fetch creator stats and recent tasks
  const [tasks, stats] = await Promise.all([
    prisma.task.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        _count: {
          select: {
            applications: true,
            submissions: true
          }
        }
      }
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { creatorId: session.user.id },
      _count: true
    })
  ])

  const totalTasks = stats.reduce((sum, s) => sum + s._count, 0)
  const activeTasks = stats.find(s => s.status === 'ACTIVE')?._count || 0
  const completedTasks = stats.find(s => s.status === 'COMPLETED')?._count || 0

  // Count pending submissions
  const pendingSubmissions = await prisma.submission.count({
    where: {
      task: {
        creatorId: session.user.id
      },
      status: 'SUBMITTED'
    }
  })

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <PageHeader
          title="Creator Dashboard"
          description="Manage your tasks and review submissions"
          actions={
            <Button variant="gradient" size="lg" asChild>
              <Link href="/new-task">
                <Plus className="mr-2 h-5 w-5" />
                Create Task
              </Link>
            </Button>
          }
        />

        {/* Alert for pending submissions */}
        {pendingSubmissions > 0 && (
          <Alert className="mb-8 border-warning/50 bg-warning/5">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              You have {pendingSubmissions} pending {pendingSubmissions === 1 ? 'submission' : 'submissions'} awaiting review.{' '}
              <Link href="/tasks" className="font-medium underline underline-offset-4 hover:text-warning">
                Review now
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            label="Total Tasks"
            value={totalTasks}
            icon={FileText}
            description="All time"
          />
          <StatCard
            label="Active Tasks"
            value={activeTasks}
            icon={Clock}
            description="Currently running"
            variant="primary"
          />
          <StatCard
            label="Completed"
            value={completedTasks}
            icon={CheckCircle}
            description="Successfully finished"
            variant="success"
          />
          <StatCard
            label="Pending Reviews"
            value={pendingSubmissions}
            icon={AlertCircle}
            description="Awaiting approval"
            variant={pendingSubmissions > 0 ? "warning" : "default"}
          />
        </div>

        {/* Recent Tasks Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-grotesk">Recent Tasks</h2>
            {tasks.length >= 6 && (
              <Button variant="outline" asChild>
                <Link href="/tasks">View All Tasks</Link>
              </Button>
            )}
          </div>

          {/* Recent Tasks Grid */}
          {tasks.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={{
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    category: task.category,
                    status: task.status as any,
                    totalBudget: task.totalBudget,
                    paymentPerWorker: task.paymentPerWorker ?? undefined,
                    maxWorkers: task.maxWorkers,
                    currentWorkers: task.currentWorkers,
                    deadline: task.deadline
                  }}
                  view="creator"
                  className="transition-all duration-200 hover:border-primary/50 hover:shadow-xl hover:-translate-y-2"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="mb-4 rounded-full bg-muted/50 p-6">
                <Inbox className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold font-grotesk mb-2">
                No Tasks Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Create your first task to get started with ValidaCheck and connect with skilled agents.
              </p>
              <Button variant="gradient" size="lg" asChild>
                <Link href="/new-task">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Task
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
