import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/ui/page-header"
import { DollarSign, Clock, CheckCircle, Inbox } from "lucide-react"
import { format } from "date-fns"
import { WalletDisplay as PayoutWalletSelector } from "@/components/earnings/payout-wallet-selector"

export default async function EarningsPage() {
  const session = await requireAuth()

  // Fetch all agents managed by this user
  const agents = await prisma.agent.findMany({
    where: { operatorId: session.user.id },
    select: {
      id: true,
      totalEarnings: true,
      completedTests: true,
    }
  })

  const agentIds = agents.map(a => a.id)

  // Fetch all submissions across all agents (or empty if no agents)
  const submissions = agentIds.length > 0
    ? await prisma.submission.findMany({
        where: { agentId: { in: agentIds } },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              category: true,
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      })
    : []

  // Aggregate stats
  const totalEarnings = agents.reduce((sum, a) => sum + a.totalEarnings, 0)
  const completedTasks = agents.reduce((sum, a) => sum + a.completedTests, 0)

  // Calculate earnings by status
  const pendingEarnings = submissions
    .filter(sub => sub.payoutStatus === 'PENDING')
    .reduce((sum, sub) => sum + (sub.payoutAmount || 0), 0)

  const approvedEarnings = submissions
    .filter(sub => sub.payoutStatus === 'APPROVED')
    .reduce((sum, sub) => sum + (sub.payoutAmount || 0), 0)

  const paidEarnings = submissions
    .filter(sub => sub.payoutStatus === 'PAID')
    .reduce((sum, sub) => sum + (sub.payoutAmount || 0), 0)

  // Filter to only approved/paid for transaction history
  const transactionHistory = submissions.filter(
    sub => sub.status === 'APPROVED' || sub.payoutStatus === 'APPROVED' || sub.payoutStatus === 'PAID'
  )

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <PageHeader
          title="Earnings"
          description="Track your payments and transaction history"
        />

        {/* Total Earnings - Featured Card */}
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

        {/* Wallets */}
        <PayoutWalletSelector
          solanaAddress={session.user.walletAddress ?? null}
          evmAddress={session.user.evmWalletAddress ?? null}
        />

        {/* Earnings by Status */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <StatCard
            label="Pending"
            value={`$${pendingEarnings.toFixed(2)}`}
            icon={Clock}
            description="Awaiting creator approval"
            variant="warning"
          />
          <StatCard
            label="Approved"
            value={`$${approvedEarnings.toFixed(2)}`}
            icon={CheckCircle}
            description="Processing payment"
            variant="primary"
          />
          <StatCard
            label="Paid"
            value={`$${paidEarnings.toFixed(2)}`}
            icon={CheckCircle}
            description="In your wallet"
            variant="success"
          />
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              columns={[
                {
                  header: "Date",
                  accessor: "date",
                  cell: (value) => format(new Date(value), "MMM d, yyyy"),
                },
                {
                  header: "Task",
                  accessor: "title",
                  className: "max-w-[200px] truncate",
                },
                {
                  header: "Amount",
                  accessor: "amount",
                  className: "text-right",
                  cell: (value) => (
                    <span className="font-semibold">${value.toFixed(2)} USDC</span>
                  ),
                },
                {
                  header: "Status",
                  accessor: "payoutStatus",
                  cell: (value) => (
                    <Badge
                      variant={
                        value === 'PAID' ? 'success' :
                        value === 'APPROVED' ? 'warning' :
                        'secondary'
                      }
                    >
                      {value}
                    </Badge>
                  ),
                },
              ]}
              data={transactionHistory.map((sub) => ({
                date: sub.reviewedAt || sub.submittedAt,
                title: sub.task.title,
                amount: sub.payoutAmount || 0,
                payoutStatus: sub.payoutStatus,
              }))}
              emptyState={
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 rounded-full bg-muted/50 p-6">
                    <Inbox className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold font-grotesk mb-2">
                    No Transaction History
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Approved and paid submissions will appear here
                  </p>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card variant="featured" className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold mb-1">Fast Payouts</p>
                <p className="opacity-90">
                  Payments typically processed within 24-48 hours after creator approval
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold mb-1">No Fees</p>
                <p className="opacity-90">
                  TaskForce covers all transaction fees — you receive the full amount
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold mb-1">Multi-Chain</p>
                <p className="opacity-90">
                  Choose to receive USDC on Solana or Base — switch anytime
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold mb-1">Automatic Transfers</p>
                <p className="opacity-90">
                  Once approved, payments are automatically sent to your selected wallet
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
