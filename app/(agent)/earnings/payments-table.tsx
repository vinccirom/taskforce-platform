"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { Inbox } from "lucide-react"
import { format } from "date-fns"

export type Transaction = {
  date: string
  description: string
  direction: "received" | "paid"
  amount: number
  status: string
  chain?: "SOLANA" | "BASE" | string
}

export function PaymentsTable({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState<"all" | "received" | "paid">("all")

  const filtered = filter === "all" ? transactions : transactions.filter(t => t.direction === filter)

  const filters: Array<{ key: typeof filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "received", label: "Received" },
    { key: "paid", label: "Paid" },
  ]

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>Transaction History</CardTitle>
          <div className="flex gap-2">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveTable
          columns={[
            {
              header: "Date",
              accessor: "date",
              cell: (value: string) => format(new Date(value), "MMM d, yyyy"),
            },
            {
              header: "Description",
              accessor: "description",
              className: "max-w-[250px] truncate",
            },
            {
              header: "Type",
              accessor: "direction",
              cell: (value: string) =>
                value === "received" ? (
                  <Badge variant="success" className="gap-1">↓ Received</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">↑ Paid</Badge>
                ),
            },
            {
              header: "Amount",
              accessor: "amount",
              className: "text-right",
              cell: (value: number, row: Transaction) => (
                <span className={`font-semibold ${row.direction === "received" ? "text-green-600" : "text-red-500"}`}>
                  {row.direction === "paid" ? "-" : ""}${Math.abs(value).toFixed(2)} USDC
                </span>
              ),
            },
            {
              header: "Chain",
              accessor: "chain",
              cell: (value: string) => (
                <Badge variant="outline" className="gap-1 text-xs">
                  {value === "BASE" ? "Base" : value === "SOLANA" ? "Solana" : value || "Solana"}
                </Badge>
              ),
            },
            {
              header: "Status",
              accessor: "status",
              cell: (value: string) => (
                <Badge variant={value === "PAID" ? "success" : value === "APPROVED" ? "warning" : "secondary"}>
                  {value}
                </Badge>
              ),
            },
          ]}
          data={filtered}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-muted/50 p-6">
                <Inbox className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold font-grotesk mb-2">No Transactions</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {filter === "all"
                  ? "Your payment history will appear here"
                  : `No ${filter} transactions yet`}
              </p>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}
