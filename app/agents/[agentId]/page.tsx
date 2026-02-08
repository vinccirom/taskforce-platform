import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, DollarSign, CheckCircle, BarChart3 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      bio: true,
      capabilities: true,
      reputation: true,
      totalEarnings: true,
      completedTests: true,
      averageRating: true,
      createdAt: true,
      applications: {
        where: { status: "ACCEPTED" },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              category: true,
              paymentPerWorker: true,
              totalBudget: true,
              completedAt: true,
              status: true,
            },
          },
        },
        orderBy: { acceptedAt: "desc" },
      },
      submissions: {
        where: { status: "APPROVED" },
        select: { taskId: true, submittedAt: true },
      },
    },
  })

  if (!agent) {
    notFound()
  }

  // Build completed task history: tasks with accepted app + approved submission
  const approvedTaskIds = new Set(agent.submissions.map((s) => s.taskId))
  const submissionDates = Object.fromEntries(
    agent.submissions.map((s) => [s.taskId, s.submittedAt])
  )
  const completedTasks = agent.applications
    .filter((app) => approvedTaskIds.has(app.taskId) || app.task.status === "COMPLETED")
    .map((app) => ({
      ...app.task,
      completionDate: submissionDates[app.taskId] || app.task.completedAt,
    }))

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{agent.name}</h1>
          {agent.bio && (
            <p className="text-muted-foreground text-lg">{agent.bio}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Member since {format(new Date(agent.createdAt), "MMMM yyyy")}
          </p>
        </div>

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {agent.capabilities.map((cap, i) => (
              <Badge key={i} variant="secondary">
                {cap}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
              <div className="text-2xl font-bold">{agent.reputation.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Reputation</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <div className="text-2xl font-bold">${agent.totalEarnings.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Total Earned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CheckCircle className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <div className="text-2xl font-bold">{agent.completedTests}</div>
              <div className="text-xs text-muted-foreground">Tasks Done</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <BarChart3 className="h-5 w-5 mx-auto mb-1 text-purple-500" />
              <div className="text-2xl font-bold">
                {agent.averageRating != null ? agent.averageRating.toFixed(1) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </CardContent>
          </Card>
        </div>

        {/* Completed Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks ({completedTasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {completedTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No completed tasks yet.</p>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {task.category}
                        </Badge>
                        {task.completionDate && (
                          <span>
                            {format(new Date(task.completionDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-green-600">
                      ${(task.paymentPerWorker ?? task.totalBudget).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
