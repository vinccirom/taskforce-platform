import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

const statCardVariants = cva(
  "border-2 rounded-xl p-6 transition-all duration-200 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-card border-border hover:border-border hover:shadow-lg hover:-translate-y-1",
        success: "bg-card border-border hover:border-green-500/50 hover:shadow-lg hover:-translate-y-1",
        warning: "bg-card border-border hover:border-amber-500/50 hover:shadow-lg hover:-translate-y-1",
        primary: "bg-card border-border hover:border-primary/50 hover:shadow-lg hover:-translate-y-1",
        featured: "bg-gradient-to-br from-purple-600 to-cyan-500 border-transparent text-white hover:shadow-2xl hover:-translate-y-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const statValueVariants = cva(
  "text-2xl font-bold font-grotesk",
  {
    variants: {
      variant: {
        default: "text-foreground",
        success: "text-green-600 dark:text-green-400",
        warning: "text-amber-600 dark:text-amber-400",
        primary: "text-primary",
        featured: "text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  description?: string;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, variant, label, value, icon: Icon, trend, loading, description, ...props }, ref) => {
    if (loading) {
      return (
        <div ref={ref} className={cn(statCardVariants({ variant }), className)} {...props}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              {description && <Skeleton className="h-3 w-full" />}
            </div>
            {Icon && (
              <div className="ml-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            )}
          </div>
          {trend && <Skeleton className="h-3 w-20 mt-3" />}
        </div>
      );
    }

    return (
      <div ref={ref} className={cn(statCardVariants({ variant }), className)} {...props}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className={cn(
              "text-sm font-medium mb-2",
              variant === "featured" ? "text-white/90" : "text-muted-foreground"
            )}>
              {label}
            </p>
            <p className={statValueVariants({ variant })}>
              {value}
            </p>
            {description && (
              <p className={cn(
                "text-xs mt-1",
                variant === "featured" ? "text-white/80" : "text-muted-foreground"
              )}>
                {description}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "ml-4 p-2 rounded-lg",
              variant === "featured"
                ? "bg-white/20"
                : "bg-muted/50"
            )}>
              <Icon className={cn(
                "h-6 w-6",
                variant === "featured" ? "text-white" : "text-muted-foreground"
              )} />
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-3 flex items-center text-xs">
            <span className={cn(
              "font-medium",
              trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
              variant === "featured" && "text-white"
            )}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className={cn(
              "ml-2",
              variant === "featured" ? "text-white/80" : "text-muted-foreground"
            )}>
              vs last month
            </span>
          </div>
        )}
      </div>
    );
  }
);
StatCard.displayName = "StatCard";

export { StatCard, statCardVariants };
