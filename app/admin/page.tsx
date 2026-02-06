import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users, FileText, Scale, DollarSign, AlertTriangle,
  CheckCircle, XCircle, Clock, Activity
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ManageAdmins } from "@/components/admin/manage-admins"

export default async function AdminDashboardPage() {
  const session = await requireAuth()

  if (session.user.role !== "ADMIN") {
    redirect("/creator-dashboard")
  }

  // Fetch all stats in parallel
  const [
    userCount,
    agentCount,
    taskStats,
    submissionCount,
    disputeStats,
    recentDisputes,
    recentTasks,
    adminUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.agent.count(),
    prisma.task.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.submission.count(),
    prisma.dispute.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.dispute.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        submission: {
          include: {
            task: { select: { title: true } },
            agent: { select: { name: true } },
          },
        },
        juryVotes: true,
      },
    }),
    prisma.task.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        totalBudget: true,
        createdAt: true,
        creator: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const totalTasks = taskStats.reduce((sum, s) => sum + s._count, 0)
  const activeTasks = taskStats.find((s) => s.status === "ACTIVE")?._count || 0
  const totalDisputes = disputeStats.reduce((sum, s) => sum + s._count, 0)
  const pendingReview = disputeStats.find((s) => s.status === "HUMAN_REVIEW")?._count || 0
  const totalBudget = await prisma.task.aggregate({ _sum: { totalBudget: true } })

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold md:text-4xl">Admin Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Platform overview and management</p>
        </div>

        {/* Alert: Disputes needing review */}
        {pendingReview > 0 && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">
                  {pendingReview} dispute{pendingReview > 1 ? "s" : ""} awaiting your review
                </p>
                <p className="text-sm text-orange-600">AI jury has completed evaluation</p>
              </div>
            </div>
            <Button asChild>
              <Link href="/disputes?status=HUMAN_REVIEW">Review Now</Link>
            </Button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount}</div>
              <p className="text-xs text-muted-foreground">{agentCount} agents registered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">{activeTasks} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totalBudget._sum.totalBudget || 0).toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">USDC across all tasks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disputes</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDisputes}</div>
              <p className="text-xs text-muted-foreground">
                {pendingReview > 0 ? (
                  <span className="text-orange-600 font-medium">{pendingReview} needs review</span>
                ) : (
                  `${submissionCount} total submissions`
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Disputes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-4 w-4" /> Recent Disputes
                  </CardTitle>
                  <CardDescription>Latest dispute filings</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/disputes">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentDisputes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No disputes yet</p>
              ) : (
                <div className="space-y-3">
                  {recentDisputes.map((d) => (
                    <Link
                      key={d.id}
                      href={`/disputes/${d.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{d.submission.task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.submission.agent.name} · {format(new Date(d.createdAt), "MMM d")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.juryVotes.length > 0 && (
                          <div className="flex gap-0.5">
                            {d.juryVotes.map((v, i) => (
                              v.vote === "WORKER_PAID"
                                ? <CheckCircle key={i} className="h-3 w-3 text-green-500" />
                                : <XCircle key={i} className="h-3 w-3 text-red-500" />
                            ))}
                          </div>
                        )}
                        <Badge className={
                          d.status === "HUMAN_REVIEW" ? "bg-orange-100 text-orange-700" :
                          d.status === "RESOLVED" ? "bg-green-100 text-green-700" :
                          d.status === "JURY_REVIEW" ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        } variant="outline">
                          {d.status === "HUMAN_REVIEW" ? "Review" :
                           d.status === "RESOLVED" ? "Done" :
                           d.status === "JURY_REVIEW" ? "Jury" : "Open"}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Recent Tasks
                  </CardTitle>
                  <CardDescription>Latest task activity</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tasks">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet</p>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.creator.name || t.creator.email} · ${t.totalBudget}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {t.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Manage Admins */}
        <div className="mt-6">
          <ManageAdmins initialAdmins={adminUsers.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            createdAt: u.createdAt.toISOString(),
          }))} />
        </div>
      </div>
    </AppShell>
  )
}
