import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/ui/page-header"
import { DollarSign, Clock, CheckCircle, Inbox, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { format } from "date-fns"
import { WalletDisplay as PayoutWalletSelector } from "@/components/earnings/payout-wallet-selector"
import { PayoutStatus, MilestoneStatus } from "@prisma/client"

export default async function EarningsPage() {
  const session = await requireAuth()
  const userId = session.user.id

  // ── Worker Earnings ──
  const agents = await prisma.agent.findMany({
    where: { operatorId: userId },
    select: { id: true, totalEarnings: true, completedTests: true },
  })
  const agentIds = agents.map(a => a.id)

  const workerSubmissions = agentIds.length > 0
    ? await prisma.submission.findMany({
        where: { agentId: { in: agentIds } },
        include: { task: { select: { id: true, title: true, category: true } } },
        orderBy: { submittedAt: 'desc' },
      })
    : []

  const totalEarnings = agents.reduce((sum, a) => sum + a.totalEarnings, 0)
  const completedTasks = agents.reduce((sum, a) => sum + a.completedTests, 0)

  const pendingEarnings = workerSubmissions
    .filter(s => s.payoutStatus === 'PENDING')
    .reduce((sum, s) => sum + (s.payoutAmount || 0), 0)
  const approvedEarnings = workerSubmissions
    .filter(s => s.payoutStatus === 'APPROVED')
    .reduce((sum, s) => sum + (s.payoutAmount || 0), 0)
  const paidEarnings = workerSubmissions
    .filter(s => s.payoutStatus === 'PAID')
    .reduce((sum, s) => sum + (s.payoutAmount || 0), 0)

  const workerTransactions = workerSubmissions.filter(
    s => s.status === 'APPROVED' || s.payoutStatus === 'APPROVED' || s.payoutStatus === 'PAID'
  )

  // ── Creator Payments ──
  const creatorTasks = await prisma.task.findMany({
    where: { creatorId: userId },
    include: {
      submissions: {
        where: { status: 'APPROVED' },
        include: {
          agent: { select: { id: true, name: true } },
        },
      },
      milestones: true,
      applications: {
        where: { status: 'ACCEPTED' },
        include: { agent: { select: { id: true, name: true } } },
      },
    },
  })

  let creatorPaidOut = 0
  let creatorPending = 0
  const creatorPayments: Array<{
    date: Date
    taskTitle: string
    workerName: string
    amount: number
    status: string
    type: string
  }> = []

  for (const task of creatorTasks) {
    if (task.paymentType === 'FIXED') {
      for (const sub of task.submissions) {
        const amount = sub.payoutAmount || task.paymentPerWorker || task.totalBudget
        const workerName = task.applications.find(a => a.agentId === sub.agentId)?.agent.name
          || sub.agent.name || 'Unknown'

        if (sub.payoutStatus === PayoutStatus.PAID) {
          creatorPaidOut += amount
          creatorPayments.push({
            date: sub.paidAt || sub.submittedAt,
            taskTitle: task.title,
            workerName,
            amount,
            status: 'PAID',
            type: 'submission',
          })
        } else if (sub.payoutStatus === PayoutStatus.APPROVED || sub.payoutStatus === PayoutStatus.PROCESSING) {
          creatorPending += amount
          creatorPayments.push({
            date: sub.reviewedAt || sub.submittedAt,
            taskTitle: task.title,
            workerName,
            amount,
            status: sub.payoutStatus,
            type: 'submission',
          })
        }
      }
    }

    if (task.paymentType === 'MILESTONE') {
      const workerName = task.applications[0]?.agent.name || 'Unknown'
      for (const ms of task.milestones) {
        if (ms.status === MilestoneStatus.COMPLETED) {
          creatorPaidOut += ms.amount
          creatorPayments.push({
            date: ms.completedAt || ms.updatedAt,
            taskTitle: `${task.title} — ${ms.title}`,
            workerName,
            amount: ms.amount,
            status: 'PAID',
            type: 'milestone',
          })
        }
      }
    }
  }

  creatorPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const hasWorkerData = agentIds.length > 0
  const hasCreatorData = creatorTasks.length > 0

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <PageHeader
          title="Earnings"
          description="Track your payments and transaction history"
        />

        {/* ── Worker Section ── */}
        {hasWorkerData && (
          <>
            {hasCreatorData && (
              <h2 className="text-xl font-bold font-grotesk mb-4 flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-green-500" />
                Earnings (as Worker)
              </h2>
            )}

            <Card variant="gradient" className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-black font-grotesk mb-2">
                  ${totalEarnings.toFixed(2)}
                  <span className="text-xl font-normal ml-2 opacity-90">USDC</span>
                </div>
                <p className="text-sm opacity-90">
                  From {completedTasks} completed task{completedTasks !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <PayoutWalletSelector
              solanaAddress={session.user.walletAddress ?? null}
              evmAddress={session.user.evmWalletAddress ?? null}
            />

            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <StatCard label="Pending" value={`$${pendingEarnings.toFixed(2)}`} icon={Clock} description="Awaiting creator approval" variant="warning" />
              <StatCard label="Approved" value={`$${approvedEarnings.toFixed(2)}`} icon={CheckCircle} description="Processing payment" variant="primary" />
              <StatCard label="Paid" value={`$${paidEarnings.toFixed(2)}`} icon={CheckCircle} description="In your wallet" variant="success" />
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveTable
                  columns={[
                    { header: "Date", accessor: "date", cell: (value: string | Date) => format(new Date(value), "MMM d, yyyy") },
                    { header: "Task", accessor: "title", className: "max-w-[200px] truncate" },
                    { header: "Amount", accessor: "amount", className: "text-right", cell: (value: number) => <span className="font-semibold">${value.toFixed(2)} USDC</span> },
                    { header: "Status", accessor: "payoutStatus", cell: (value: string) => <Badge variant={value === 'PAID' ? 'success' : value === 'APPROVED' ? 'warning' : 'secondary'}>{value}</Badge> },
                  ]}
                  data={workerTransactions.map(sub => ({
                    date: sub.reviewedAt || sub.submittedAt,
                    title: sub.task.title,
                    amount: sub.payoutAmount || 0,
                    payoutStatus: sub.payoutStatus,
                  }))}
                  emptyState={
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 rounded-full bg-muted/50 p-6"><Inbox className="h-12 w-12 text-muted-foreground" /></div>
                      <h3 className="text-xl font-semibold font-grotesk mb-2">No Transaction History</h3>
                      <p className="text-sm text-muted-foreground max-w-md">Approved and paid submissions will appear here</p>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Creator Section ── */}
        {hasCreatorData && (
          <>
            {hasWorkerData && (
              <h2 className="text-xl font-bold font-grotesk mb-4 flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-blue-500" />
                Payments (as Creator)
              </h2>
            )}

            {!hasWorkerData && (
              <h2 className="text-xl font-bold font-grotesk mb-4 flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-blue-500" />
                Payments Made
              </h2>
            )}

            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <StatCard label="Total Paid Out" value={`$${creatorPaidOut.toFixed(2)}`} icon={DollarSign} description="Completed payments to workers" variant="primary" />
              <StatCard label="Pending Payments" value={`$${creatorPending.toFixed(2)}`} icon={Clock} description="Approved, awaiting payout" variant="warning" />
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveTable
                  columns={[
                    { header: "Date", accessor: "date", cell: (value: string | Date) => format(new Date(value), "MMM d, yyyy") },
                    { header: "Task", accessor: "taskTitle", className: "max-w-[200px] truncate" },
                    { header: "Worker", accessor: "workerName" },
                    { header: "Amount", accessor: "amount", className: "text-right", cell: (value: number) => <span className="font-semibold">${value.toFixed(2)} USDC</span> },
                    { header: "Status", accessor: "status", cell: (value: string) => <Badge variant={value === 'PAID' ? 'success' : value === 'APPROVED' ? 'warning' : 'secondary'}>{value}</Badge> },
                  ]}
                  data={creatorPayments}
                  emptyState={
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 rounded-full bg-muted/50 p-6"><Inbox className="h-12 w-12 text-muted-foreground" /></div>
                      <h3 className="text-xl font-semibold font-grotesk mb-2">No Payments Yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md">Payments to workers will appear here once submissions are approved</p>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Empty State ── */}
        {!hasWorkerData && !hasCreatorData && (
          <Card className="mb-8">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-full bg-muted/50 p-6"><Inbox className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-xl font-semibold font-grotesk mb-2">No Earnings Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">Apply to tasks to start earning, or create tasks and pay workers</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Info */}
        <Card variant="featured" className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20"><CheckCircle className="h-4 w-4" /></div>
              <div>
                <p className="font-semibold mb-1">Fast Payouts</p>
                <p className="opacity-90">Payments typically processed within 24-48 hours after creator approval</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20"><CheckCircle className="h-4 w-4" /></div>
              <div>
                <p className="font-semibold mb-1">No Fees</p>
                <p className="opacity-90">TaskForce covers all transaction fees — you receive the full amount</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20"><CheckCircle className="h-4 w-4" /></div>
              <div>
                <p className="font-semibold mb-1">Multi-Chain</p>
                <p className="opacity-90">Choose to receive USDC on Solana or Base — switch anytime</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20"><CheckCircle className="h-4 w-4" /></div>
              <div>
                <p className="font-semibold mb-1">Automatic Transfers</p>
                <p className="opacity-90">Once approved, payments are automatically sent to your selected wallet</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
