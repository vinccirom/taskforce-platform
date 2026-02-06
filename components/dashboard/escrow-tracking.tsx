"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TaskStatusBadge } from "@/components/task/task-status-badge"
import { MilestoneProgress } from "@/components/task/milestone-progress"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

interface EscrowTask {
  id: string
  title: string
  category: string
  status: string
  totalBudget: number
  allocatedAmount: number
  paidAmount: number
  paymentType: string
  milestonesCompleted?: number
  milestonesTotal?: number
  deadline?: Date | null
  workerName?: string
}

interface EscrowTrackingProps {
  tasks: EscrowTask[]
  className?: string
}

export function EscrowTracking({ tasks, className }: EscrowTrackingProps) {
  const totalAllocated = tasks.reduce((sum, task) => sum + task.allocatedAmount, 0)
  const totalPaid = tasks.reduce((sum, task) => sum + task.paidAmount, 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Escrow Tracking</CardTitle>
        <CardDescription>
          Monitor funds locked in active task escrow
        </CardDescription>
        <div className="flex gap-4 mt-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Total Allocated: </span>
            <span className="font-semibold">${totalAllocated.toLocaleString()} USDC</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Total Paid: </span>
            <span className="font-semibold text-green-600">${totalPaid.toLocaleString()} USDC</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active tasks with allocated funds
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const remaining = task.allocatedAmount - task.paidAmount
              const percentPaid = task.allocatedAmount > 0
                ? ((task.paidAmount / task.allocatedAmount) * 100).toFixed(0)
                : 0

              return (
                <div
                  key={task.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="font-semibold hover:underline"
                        >
                          {task.title}
                        </Link>
                        <TaskStatusBadge status={task.status as any} />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <div className="font-medium">{task.category}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Budget:</span>
                          <div className="font-medium">${task.totalBudget.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Paid Out:</span>
                          <div className="font-medium text-green-600">
                            ${task.paidAmount.toLocaleString()} ({percentPaid}%)
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Remaining:</span>
                          <div className="font-medium text-blue-600">
                            ${remaining.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {task.paymentType === 'MILESTONE' && task.milestonesTotal && (
                        <div className="mt-3">
                          <MilestoneProgress
                            completed={task.milestonesCompleted || 0}
                            total={task.milestonesTotal}
                            size="sm"
                          />
                        </div>
                      )}

                      {task.workerName && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Worker: <span className="font-medium">{task.workerName}</span>
                        </div>
                      )}
                    </div>

                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/tasks/${task.id}`}>
                        View
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
