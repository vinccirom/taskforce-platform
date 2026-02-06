import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MilestoneStatusBadge, type MilestoneStatus } from "./milestone-status-badge"
import { Calendar, DollarSign, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MilestoneCardProps {
  milestone: {
    id: string
    title: string
    description?: string | null
    order: number
    percentage: number
    amount: number
    status: MilestoneStatus
    dueDate?: Date | null
    completedAt?: Date | null
    deliverable?: string | null
  }
  view?: 'creator' | 'agent'
  onSubmit?: (milestoneId: string) => void
  onApprove?: (milestoneId: string) => void
  onReject?: (milestoneId: string) => void
  className?: string
}

export function MilestoneCard({
  milestone,
  view = 'creator',
  onSubmit,
  onApprove,
  onReject,
  className
}: MilestoneCardProps) {
  const formatDate = (date?: Date | null) => {
    if (!date) return 'Not set'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isCompleted = milestone.status === 'COMPLETED'
  const isUnderReview = milestone.status === 'UNDER_REVIEW'
  const canSubmit = view === 'agent' && milestone.status === 'IN_PROGRESS'
  const canReview = view === 'creator' && isUnderReview

  return (
    <Card className={cn(
      "relative",
      isCompleted && "border-green-200 bg-green-50/50",
      className
    )}>
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Milestone {milestone.order}
              </span>
              <span className="text-xs font-medium text-primary">
                {milestone.percentage}%
              </span>
            </div>
            <CardTitle className="text-lg">{milestone.title}</CardTitle>
            {milestone.description && (
              <CardDescription className="mt-2">
                {milestone.description}
              </CardDescription>
            )}
          </div>
          <MilestoneStatusBadge status={milestone.status} />
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Payment:
            </span>
            <span className="font-semibold text-primary">
              ${milestone.amount} USDC
            </span>
          </div>

          {milestone.dueDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Due Date:
              </span>
              <span>{formatDate(milestone.dueDate)}</span>
            </div>
          )}

          {milestone.completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Completed:
              </span>
              <span>{formatDate(milestone.completedAt)}</span>
            </div>
          )}

          {milestone.deliverable && (
            <div className="mt-2 p-3 bg-muted/50 rounded-md">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Deliverable:
              </p>
              <p className="text-sm line-clamp-3">{milestone.deliverable}</p>
            </div>
          )}
        </div>
      </CardContent>

      {(canSubmit || canReview) && (
        <CardFooter className="gap-2">
          {canSubmit && (
            <Button
              className="flex-1"
              onClick={() => onSubmit?.(milestone.id)}
            >
              Submit Work
            </Button>
          )}
          {canReview && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onReject?.(milestone.id)}
              >
                Request Changes
              </Button>
              <Button
                className="flex-1"
                onClick={() => onApprove?.(milestone.id)}
              >
                Approve & Release Payment
              </Button>
            </>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
