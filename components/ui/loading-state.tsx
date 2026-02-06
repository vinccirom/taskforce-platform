import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  type: "page" | "section" | "card" | "table";
  count?: number;
}

const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, type, count = 1, ...props }, ref) => {
    switch (type) {
      case "page":
        return (
          <div ref={ref} className={cn("space-y-8", className)} {...props}>
            {/* Page Header */}
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-5 w-96" />
            </div>
            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
            {/* Content Section */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        );

      case "section":
        return (
          <div ref={ref} className={cn("space-y-4", className)} {...props}>
            <Skeleton className="h-8 w-48" />
            <div className="space-y-3">
              {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>
        );

      case "card":
        return (
          <div ref={ref} className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)} {...props}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="border-2 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between pt-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        );

      case "table":
        return (
          <div ref={ref} className={cn("space-y-3", className)} {...props}>
            {/* Table Header */}
            <div className="flex gap-4 pb-3 border-b">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            {/* Table Rows */}
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex gap-4 py-3">
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  }
);
LoadingState.displayName = "LoadingState";

export { LoadingState };
