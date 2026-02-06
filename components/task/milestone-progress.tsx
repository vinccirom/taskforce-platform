import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface MilestoneProgressProps {
  completed: number
  total: number
  showBar?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MilestoneProgress({
  completed,
  total,
  showBar = false,
  className,
  size = 'md'
}: MilestoneProgressProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  if (showBar) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className={cn("font-medium", sizeClasses[size])}>
            Milestones: {completed}/{total}
          </span>
          <span className={cn("text-muted-foreground", sizeClasses[size])}>
            {Math.round(percentage)}%
          </span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, index) => {
          const isCompleted = index < completed
          return isCompleted ? (
            <CheckCircle2
              key={index}
              className={cn(
                "text-green-500",
                size === 'sm' && "h-3 w-3",
                size === 'md' && "h-4 w-4",
                size === 'lg' && "h-5 w-5"
              )}
            />
          ) : (
            <Circle
              key={index}
              className={cn(
                "text-gray-300",
                size === 'sm' && "h-3 w-3",
                size === 'md' && "h-4 w-4",
                size === 'lg' && "h-5 w-5"
              )}
            />
          )
        })}
      </div>
      <span className={cn("text-muted-foreground font-medium", sizeClasses[size])}>
        {completed}/{total}
      </span>
    </div>
  )
}
