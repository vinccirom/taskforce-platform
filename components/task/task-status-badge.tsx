import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TaskStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'

interface TaskStatusBadgeProps {
  status: TaskStatus
  className?: string
}

const statusConfig: Record<TaskStatus, { label: string; variant: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    variant: 'secondary',
    className: 'bg-muted text-muted-foreground'
  },
  ACTIVE: {
    label: 'Open',
    variant: 'default',
    className: 'bg-primary text-primary-foreground'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    variant: 'default',
    className: 'bg-blue-500 text-white'
  },
  COMPLETED: {
    label: 'Completed',
    variant: 'default',
    className: 'bg-green-500 text-white'
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'destructive',
    className: 'bg-destructive text-destructive-foreground'
  },
  DISPUTED: {
    label: 'Disputed',
    variant: 'destructive',
    className: 'bg-orange-500 text-white'
  }
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge
      variant={config.variant as any}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
