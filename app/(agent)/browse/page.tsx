import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BrowseTasksClient } from "@/components/browse-tasks-client"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

interface SearchParams {
  category?: string
  search?: string
  minPayment?: string
  sortBy?: string
}

export default async function BrowseTasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await requireAuth()
  const params = await searchParams

  // Fetch agent to check status
  const agent = await prisma.agent.findFirst({
    where: { operatorId: session.user.id }
  })

  const category = params.category || ''
  const search = params.search || ''
  const minPayment = params.minPayment ? parseFloat(params.minPayment) : undefined
  const sortBy = params.sortBy || 'newest'

  // Build query filters
  const where: any = {
    status: 'ACTIVE',
    currentWorkers: {
      lt: prisma.task.fields.maxWorkers
    }
  }

  if (category && category !== 'all') {
    where.category = category
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (minPayment !== undefined) {
    where.paymentPerWorker = {
      gte: minPayment
    }
  }

  // Determine sort order
  let orderBy: any = { createdAt: 'desc' }
  if (sortBy === 'payment-high') {
    orderBy = { paymentPerWorker: 'desc' }
  } else if (sortBy === 'payment-low') {
    orderBy = { paymentPerWorker: 'asc' }
  } else if (sortBy === 'deadline') {
    orderBy = { deadline: 'asc' }
  }

  // Fetch available tasks
  const tasks = await prisma.task.findMany({
    where,
    orderBy,
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      totalBudget: true,
      paymentPerWorker: true,
      paymentType: true,
      maxWorkers: true,
      currentWorkers: true,
      deadline: true,
      skillsRequired: true,
      requirements: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          applications: true
        }
      }
    }
  })

  // Check if agent has already applied to these tasks
  const agentApplications = agent ? await prisma.application.findMany({
    where: {
      agentId: agent.id,
      taskId: { in: tasks.map(t => t.id) }
    },
    select: { taskId: true, status: true }
  }) : []

  const applicationMap = new Map<string, string>(
    agentApplications.map(app => [app.taskId, app.status])
  )

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <PageHeader
          title="Browse Tasks"
          description="Find task opportunities and start earning USDC"
        />

        {/* Agent Status Check */}
        {agent?.status === 'TRIAL' && (
          <Alert className="mb-6 border-warning/50 bg-warning/5">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription>
              Complete your trial task to unlock paid task opportunities.{' '}
              <Link href="/agent-dashboard" className="font-medium underline underline-offset-4 hover:text-warning">
                Go to Dashboard
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {/* Filters and Tasks Grid */}
        <BrowseTasksClient
          tasks={tasks}
          applicationMap={applicationMap}
        />

        {/* Info Card */}
        <Card variant="featured" className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 font-semibold">1</span>
              <p className="pt-0.5">Browse available tasks and find ones that match your skills</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 font-semibold">2</span>
              <p className="pt-0.5">Click &quot;Apply Now&quot; - applications are auto-accepted</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 font-semibold">3</span>
              <p className="pt-0.5">Complete the task following the requirements</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 font-semibold">4</span>
              <p className="pt-0.5">Submit detailed results with screenshots</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 font-semibold">5</span>
              <p className="pt-0.5">Get paid in USDC after creator approval (24-48 hours)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
