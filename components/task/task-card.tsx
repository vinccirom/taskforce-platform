"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TaskStatusBadge, type TaskStatus } from "./task-status-badge"
import { CategoryBadge } from "./category-badge"
import Link from "next/link"
import { Calendar, DollarSign, Users } from "lucide-react"

interface TaskCardProps {
  task: {
    id: string
    title: string
    description: string
    category: string
    status: TaskStatus
    totalBudget: number
    paymentPerWorker?: number
    maxWorkers: number
    currentWorkers: number
    deadline?: Date | null
  }
  view?: 'creator' | 'agent'
  onApply?: (taskId: string) => void
  className?: string
}

export function TaskCard({ task, view = 'creator', onApply, className }: TaskCardProps) {
  const formatDate = (date?: Date | null) => {
    if (!date) return 'No deadline'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatRelativeTime = (date?: Date | null) => {
    if (!date) return 'No deadline'
    const now = new Date()
    const targetDate = new Date(date)
    const diffInDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays < 0) return 'Expired'
    if (diffInDays === 0) return 'Due today'
    if (diffInDays === 1) return 'Due tomorrow'
    if (diffInDays <= 7) return `${diffInDays} days left`
    return formatDate(date)
  }

  const slotsRemaining = task.maxWorkers - task.currentWorkers
  const isSlotsFull = slotsRemaining <= 0
  const payment = task.paymentPerWorker || task.totalBudget

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl mb-2">{task.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {task.description}
            </CardDescription>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Category:</span>
            <CategoryBadge category={task.category} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Payment:
            </span>
            <span className="font-semibold text-primary">
              ${payment} USDC
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Slots:
            </span>
            <span className={slotsRemaining <= 2 && !isSlotsFull ? "text-warning font-medium" : ""}>
              {task.currentWorkers}/{task.maxWorkers}
              {!isSlotsFull && ` (${slotsRemaining} left)`}
              {isSlotsFull && " (Full)"}
            </span>
          </div>

          {task.deadline && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Deadline:
              </span>
              <span>
                {view === 'agent' ? formatRelativeTime(task.deadline) : formatDate(task.deadline)}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {view === 'creator' ? (
          <>
            <Button variant="outline" asChild className="flex-1">
              <Link href={`/tasks/${task.id}`}>View Details</Link>
            </Button>
            {task.status === 'ACTIVE' && (
              <Button asChild className="flex-1">
                <Link href={`/tasks/${task.id}/submissions`}>
                  Review Submissions
                </Link>
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" asChild className="flex-1">
              <Link href={`/browse/${task.id}`}>View Details</Link>
            </Button>
            {task.status === 'ACTIVE' && !isSlotsFull && (
              <Button
                className="flex-1"
                onClick={() => onApply?.(task.id)}
              >
                Apply Now
              </Button>
            )}
            {isSlotsFull && (
              <Button disabled className="flex-1">
                Slots Full
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  )
}
