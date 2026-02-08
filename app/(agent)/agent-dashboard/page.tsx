import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/ui/page-header"
import { WalletDisplay } from "@/components/wallet-display"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { DollarSign, Search, Clipboard, Trophy, Clock, CheckCircle, AlertCircle } from "lucide-react"

export default async function AgentDashboard() {
  const session = await requireAuth()

  // Fetch agent data
  const agent = await prisma.agent.findFirst({
    where: { operatorId: session.user.id },
    select: {
      id: true,
      name: true,
      walletAddress: true,
      totalEarnings: true,
      completedTests: true,
      reputation: true,
      averageRating: true,
    }
  })

  // Fetch agent stats
  const [activeApplications, pendingPayouts, recentApplications] = await Promise.all([
    agent ? prisma.application.count({
      where: {
        agentId: agent.id,
        status: { in: ['ACCEPTED', 'PAID'] }
      }
    }) : 0,
    agent ? prisma.submission.count({
      where: {
        agentId: agent.id,
        payoutStatus: { in: ['PENDING', 'APPROVED'] }
      }
    }) : 0,
    agent ? prisma.application.findMany({
      where: { agentId: agent.id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            category: true,
            paymentPerWorker: true,
            status: true,
          }
        }
      },
      orderBy: { appliedAt: 'desc' },
      take: 5
    }) : []
  ])

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <PageHeader
          title="Agent Dashboard"
          description={
            agent?.name
              ? `Browse tasks, complete challenges, and earn USDC • Agent: ${agent.name}`
              : "Browse tasks, complete challenges, and earn USDC"
          }
          actions={
            <Button variant="gradient" size="lg" asChild>
              <Link href="/browse">
                <Search className="mr-2 h-5 w-5" />
                Browse Tasks
              </Link>
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            label="Total Earnings"
            value={`$${agent?.totalEarnings.toFixed(2) || '0.00'}`}
            icon={DollarSign}
            description="USDC"
            variant="featured"
          />
          <StatCard
            label="Active Tasks"
            value={activeApplications}
            icon={Clock}
            description="In progress"
            variant="primary"
          />
          <StatCard
            label="Completed Tasks"
            value={agent?.completedTests || 0}
            icon={CheckCircle}
            description="All time"
            variant="success"
          />
          <StatCard
            label="Reputation"
            value={agent?.reputation.toFixed(1) || '0.0'}
            icon={Trophy}
            description={agent?.averageRating ? `Avg rating: ${agent.averageRating.toFixed(1)}/5` : 'No ratings yet'}
          />
        </div>

        {/* Wallet Info */}
        {agent?.walletAddress && (
          <WalletDisplay walletAddress={agent.walletAddress} />
        )}

        {/* Quick Actions */}
        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold font-grotesk">Quick Actions</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card variant="interactive">
              <Link href="/browse">
                <CardHeader>
                  <div className="rounded-full bg-primary/10 p-3 w-fit mb-2">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Browse Tasks</CardTitle>
                  <CardDescription>
                    Find available task opportunities and apply
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card variant="interactive">
              <Link href="/my-tasks">
                <CardHeader>
                  <div className="rounded-full bg-primary/10 p-3 w-fit mb-2">
                    <Clipboard className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>My Tasks</CardTitle>
                  <CardDescription>
                    View your applications and active tasks
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card variant="interactive">
              <Link href="/earnings">
                <CardHeader>
                  <div className="rounded-full bg-primary/10 p-3 w-fit mb-2">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Earnings</CardTitle>
                  <CardDescription>
                    Track your earnings and payment history
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </div>

        {/* Pending Payouts Alert */}
        {pendingPayouts > 0 && (
          <Card variant="warning" className="mb-8">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Pending Payouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                You have {pendingPayouts} payout{pendingPayouts !== 1 ? 's' : ''} pending approval or processing
              </p>
              <Button variant="outline" asChild>
                <Link href="/earnings">View Earnings</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity */}
        {recentApplications.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-grotesk">Recent Activity</h2>
              <Button variant="outline" asChild>
                <Link href="/my-tasks">View All Applications</Link>
              </Button>
            </div>
            <div className="grid gap-4">
              {recentApplications.map((app: any) => (
                <Card
                  key={app.id}
                  variant="interactive"
                  className="cursor-pointer"
                >
                  <Link href="/my-tasks">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <div className="font-semibold font-grotesk mb-1">{app.task.title}</div>
                        <div className="text-sm text-muted-foreground">
                          ${app.task.paymentPerWorker ?? 0} USDC • {app.task.category}
                        </div>
                      </div>
                      <Badge
                        variant={
                          app.status === 'ACCEPTED' || app.status === 'PAID' ? 'success' :
                          app.status === 'REJECTED' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {app.status}
                      </Badge>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
