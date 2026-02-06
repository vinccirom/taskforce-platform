import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveTableColumn {
  header: string;
  accessor: string;
  className?: string;
  cell?: (value: any, row: any) => React.ReactNode;
  mobileLabel?: string; // Override label for mobile view
}

export interface ResponsiveTableProps<T = any> extends React.HTMLAttributes<HTMLDivElement> {
  columns: ResponsiveTableColumn[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}

const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ className, columns, data, onRowClick, emptyState, ...props }, ref) => {
    if (data.length === 0 && emptyState) {
      return <div ref={ref}>{emptyState}</div>;
    }

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                {columns.map((column, i) => (
                  <th
                    key={i}
                    className={cn(
                      "text-left py-3 px-4 text-sm font-semibold text-muted-foreground",
                      column.className
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b transition-colors",
                    onRowClick && "cursor-pointer hover:bg-accent/50"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column, j) => (
                    <td
                      key={j}
                      className={cn("py-4 px-4", column.className)}
                    >
                      {column.cell
                        ? column.cell(row[column.accessor], row)
                        : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {data.map((row, i) => (
            <div
              key={i}
              className={cn(
                "border-2 rounded-xl p-4 space-y-3 transition-all duration-200",
                onRowClick && "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:-translate-y-1"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column, j) => (
                <div key={j} className="flex items-start justify-between gap-4">
                  <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                    {column.mobileLabel || column.header}:
                  </span>
                  <span className="text-sm text-right flex-1">
                    {column.cell
                      ? column.cell(row[column.accessor], row)
                      : row[column.accessor]}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
ResponsiveTable.displayName = "ResponsiveTable";

export { ResponsiveTable };
