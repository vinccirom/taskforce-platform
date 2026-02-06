"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Clock, CheckCircle, DollarSign, Users, FileText, AlertCircle, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface PendingPayout {
  id: string
  agentName: string
  agentWallet: string
  testTitle: string
  amount: number
  submittedAt: string
  feedback: string
}

export default function AdminDashboard() {
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([])
  const [selectedPayout, setSelectedPayout] = useState<PendingPayout | null>(null)
  const [approveDialog, setApproveDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [stats, setStats] = useState({
    totalTests: 0,
    totalAgents: 0,
    pendingSubmissions: 0,
    totalPayouts: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch pending payouts
      const res = await fetch('/api/admin/payouts/pending')
      if (res.ok) {
        const data = await res.json()
        setPendingPayouts(data.payouts || [])
        setStats({
          totalTests: data.stats?.totalTests || 0,
          totalAgents: data.stats?.totalAgents || 0,
          pendingSubmissions: data.payouts?.length || 0,
          totalPayouts: data.stats?.totalPayouts || 0
        })
      }
    } catch (error) {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedPayout) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/payouts/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: selectedPayout.id })
      })

      if (!res.ok) throw new Error('Failed to approve payout')

      const data = await res.json()

      toast.success(`Payout approved! TX: ${data.transactionHash?.substring(0, 10)}...`)
      setApproveDialog(false)
      setSelectedPayout(null)
      fetchData() // Refresh data
    } catch (error: any) {
      toast.error(error.message || "Failed to approve payout")
    } finally {
      setProcessing(false)
    }
  }

  const openApproveDialog = (payout: PendingPayout) => {
    setSelectedPayout(payout)
    setApproveDialog(true)
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold md:text-4xl">Admin Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Manage payouts and monitor platform activity
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTests}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registered Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pendingSubmissions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalPayouts.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Payout Approvals</CardTitle>
            <CardDescription>
              Review and approve agent submissions for payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingPayouts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        {format(new Date(payout.submittedAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{payout.agentName}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {payout.testTitle}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${payout.amount.toFixed(2)} USDC
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payout.agentWallet.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openApproveDialog(payout)}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                <p className="font-medium mb-2">All Caught Up!</p>
                <p className="text-sm">No pending payouts to review</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Payout Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-primary">1.</span>
              <p>Agents submit test results with feedback and screenshots</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-primary">2.</span>
              <p>Creators review and approve quality submissions</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-primary">3.</span>
              <p>Approved submissions appear here for admin payout processing</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-primary">4.</span>
              <p>Click "Approve" to trigger USDC transfer to agent's Solana wallet</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-primary">5.</span>
              <p>Transaction completes within 1-2 minutes on Solana blockchain</p>
            </div>
          </CardContent>
        </Card>

        {/* Approve Dialog */}
        <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Payout</DialogTitle>
              <DialogDescription>
                This will trigger a USDC transfer to the agent's wallet
              </DialogDescription>
            </DialogHeader>

            {selectedPayout && (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This action will send ${selectedPayout.amount} USDC to the agent's wallet.
                  </AlertDescription>
                </Alert>

                <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agent:</span>
                    <span className="font-medium">{selectedPayout.agentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Test:</span>
                    <span className="font-medium truncate max-w-[200px]">
                      {selectedPayout.testTitle}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold text-primary">
                      ${selectedPayout.amount} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet:</span>
                    <code className="text-xs">{selectedPayout.agentWallet}</code>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Feedback Preview:</p>
                  <p className="text-sm line-clamp-3">{selectedPayout.feedback}</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setApproveDialog(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={processing}>
                {processing ? "Processing..." : "Approve & Send Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
