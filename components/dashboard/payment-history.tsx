"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Download } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface PaymentRecord {
  id: string
  date: Date
  taskTitle: string
  taskId: string
  workerName: string
  amount: number
  type: 'submission' | 'milestone'
  milestoneTitle?: string
  transactionHash?: string
  status: 'completed' | 'pending' | 'failed'
}

interface PaymentHistoryProps {
  payments: PaymentRecord[]
  className?: string
}

export function PaymentHistory({ payments, className }: PaymentHistoryProps) {
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  const exportToCsv = () => {
    const headers = ['Date', 'Task', 'Worker', 'Type', 'Amount', 'Status', 'Transaction']
    const rows = payments.map(p => [
      format(new Date(p.date), 'yyyy-MM-dd HH:mm:ss'),
      p.taskTitle,
      p.workerName,
      p.type === 'milestone' ? `Milestone: ${p.milestoneTitle}` : 'Full Payment',
      `$${p.amount}`,
      p.status,
      p.transactionHash || 'N/A'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payment-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              All payments made to workers
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <div className="text-sm mt-2">
          <span className="text-muted-foreground">Total Paid: </span>
          <span className="font-semibold text-green-600">
            ${totalPaid.toLocaleString()} USDC
          </span>
          <span className="text-muted-foreground ml-2">
            ({payments.filter(p => p.status === 'completed').length} payments)
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payment history yet
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        href={`/tasks/${payment.taskId}`}
                        className="font-medium hover:underline"
                      >
                        {payment.taskTitle}
                      </Link>
                      <Badge
                        variant={
                          payment.status === 'completed' ? 'default' :
                          payment.status === 'pending' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {payment.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <div className="font-medium">
                          {format(new Date(payment.date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Worker:</span>
                        <div className="font-medium">{payment.workerName}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <div className="font-medium">
                          {payment.type === 'milestone' ? (
                            <span>
                              Milestone
                              {payment.milestoneTitle && (
                                <span className="text-muted-foreground text-xs ml-1">
                                  ({payment.milestoneTitle})
                                </span>
                              )}
                            </span>
                          ) : (
                            'Full Payment'
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Amount:</span>
                        <div className="font-bold text-green-600">
                          ${payment.amount.toLocaleString()} USDC
                        </div>
                      </div>
                    </div>

                    {payment.transactionHash && (
                      <div className="mt-2">
                        <a
                          href={`https://solscan.io/tx/${payment.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          View transaction
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
