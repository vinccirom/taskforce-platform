import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/ui/page-header"
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Minus, CheckCircle, Inbox } from "lucide-react"
import { WalletDisplay as PayoutWalletSelector } from "@/components/earnings/payout-wallet-selector"
import { WithdrawForm } from "@/components/payments/withdraw-form"
import { PayoutStatus, MilestoneStatus } from "@prisma/client"
import { PaymentsTable, type Transaction } from "./payments-table"

export default async function PaymentsPage() {
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

  // ── Creator Payments ──
  const creatorTasks = await prisma.task.findMany({
    where: { creatorId: userId },
    include: {
      submissions: {
        where: { status: 'APPROVED' },
        include: { agent: { select: { id: true, name: true } } },
      },
      milestones: true,
      applications: {
        where: { status: 'ACCEPTED' },
        include: { agent: { select: { id: true, name: true } } },
      },
    },
  })

  // ── Build unified transactions ──
  const transactions: Transaction[] = []

  // Worker submissions → "received"
  for (const sub of workerSubmissions) {
    if (sub.status === 'APPROVED' || sub.payoutStatus === 'APPROVED' || sub.payoutStatus === 'PAID') {
      transactions.push({
        date: (sub.paidAt || sub.reviewedAt || sub.submittedAt).toISOString(),
        description: `Received for: ${sub.task.title}`,
        direction: "received",
        amount: sub.payoutAmount || 0,
        status: sub.payoutStatus,
      })
    }
  }

  // Creator payments → "paid"
  for (const task of creatorTasks) {
    if (task.paymentType === 'FIXED') {
      for (const sub of task.submissions) {
        const amount = sub.payoutAmount || task.paymentPerWorker || task.totalBudget
        const workerName = task.applications.find(a => a.agentId === sub.agentId)?.agent.name
          || sub.agent.name || 'Unknown'

        if (sub.payoutStatus === PayoutStatus.PAID || sub.payoutStatus === PayoutStatus.APPROVED || sub.payoutStatus === PayoutStatus.PROCESSING) {
          transactions.push({
            date: (sub.paidAt || sub.reviewedAt || sub.submittedAt).toISOString(),
            description: `Paid to ${workerName}: ${task.title}`,
            direction: "paid",
            amount,
            status: sub.payoutStatus === PayoutStatus.PAID ? 'PAID' : sub.payoutStatus,
          })
        }
      }
    }

    if (task.paymentType === 'MILESTONE') {
      const workerName = task.applications[0]?.agent.name || 'Unknown'
      for (const ms of task.milestones) {
        if (ms.status === MilestoneStatus.COMPLETED) {
          transactions.push({
            date: (ms.completedAt || ms.updatedAt).toISOString(),
            description: `Paid to ${workerName}: ${task.title} — ${ms.title}`,
            direction: "paid",
            amount: ms.amount,
            status: 'PAID',
          })
        }
      }
    }
  }

  // Sort newest first
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // ── Stats ──
  const totalEarned = transactions
    .filter(t => t.direction === "received" && t.status === "PAID")
    .reduce((sum, t) => sum + t.amount, 0)

  const totalSpent = transactions
    .filter(t => t.direction === "paid" && t.status === "PAID")
    .reduce((sum, t) => sum + t.amount, 0)

  const net = totalEarned - totalSpent

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <PageHeader
          title="Payments"
          description="Track all your earnings and payments in one place"
        />

        {/* Stat Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <StatCard
            label="Total Earned"
            value={`$${totalEarned.toFixed(2)}`}
            icon={ArrowDownLeft}
            description="Sum of all paid worker submissions"
            variant="success"
          />
          <StatCard
            label="Total Spent"
            value={`$${totalSpent.toFixed(2)}`}
            icon={ArrowUpRight}
            description="Sum of all payments to workers"
            variant="warning"
          />
          <StatCard
            label="Net"
            value={`${net >= 0 ? "" : "-"}$${Math.abs(net).toFixed(2)}`}
            icon={net >= 0 ? TrendingUp : net < 0 ? TrendingDown : Minus}
            description={net >= 0 ? "You're in the green" : "You've spent more than earned"}
            variant={net > 0 ? "success" : net < 0 ? "warning" : "default"}
          />
        </div>

        {/* Wallet */}
        <PayoutWalletSelector
          solanaAddress={session.user.walletAddress ?? null}
          evmAddress={session.user.evmWalletAddress ?? null}
        />

        {/* Withdraw */}
        {(session.user.walletAddress || session.user.evmWalletAddress) && (
          <WithdrawForm solanaAddress={session.user.walletAddress ?? null} evmAddress={session.user.evmWalletAddress ?? null} />
        )}

        {/* Unified Transaction Table */}
        {transactions.length > 0 ? (
          <PaymentsTable transactions={transactions} />
        ) : (
          <Card className="mb-8">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-full bg-muted/50 p-6">
                  <Inbox className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold font-grotesk mb-2">No Transactions Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Apply to tasks to start earning, or create tasks and pay workers. All activity will show up here.
                </p>
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
