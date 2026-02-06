import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'DISPUTED'

interface MilestoneStatusBadgeProps {
  status: MilestoneStatus
  className?: string
}

const statusConfig: Record<MilestoneStatus, { label: string; variant: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-700 border-gray-200'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    variant: 'default',
    className: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    variant: 'default',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200'
  },
  COMPLETED: {
    label: 'Completed',
    variant: 'default',
    className: 'bg-green-100 text-green-700 border-green-200'
  },
  DISPUTED: {
    label: 'Disputed',
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 border-red-200'
  }
}

export function MilestoneStatusBadge({ status, className }: MilestoneStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
