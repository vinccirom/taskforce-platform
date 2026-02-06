"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Lock, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface TreasuryStatsProps {
  available: number
  allocated: number
  paidOut: number
  currency?: string
  className?: string
}

export function TreasuryStats({
  available,
  allocated,
  paidOut,
  currency = "USDC",
  className
}: TreasuryStatsProps) {
  const total = available + allocated + paidOut

  const stats = [
    {
      label: "Available",
      value: available,
      description: "Ready to allocate to new tasks",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      label: "Allocated",
      value: allocated,
      description: "Locked in active task escrow",
      icon: Lock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      label: "Paid Out",
      value: paidOut,
      description: "Total paid to workers",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
  ]

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-2xl font-bold">Treasury Overview</h2>
        <p className="text-muted-foreground">
          Track your funds across all tasks
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          const percentage = total > 0 ? ((stat.value / total) * 100).toFixed(1) : 0

          return (
            <Card
              key={stat.label}
              className={cn("border-2", stat.borderColor, stat.bgColor)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.label}
                </CardTitle>
                <Icon className={cn("h-4 w-4", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stat.value.toLocaleString()} {currency}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  <span className="font-medium">{percentage}%</span>
                  <span className="ml-1">of total</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Balance</CardTitle>
          <CardDescription>
            Sum of all funds in your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            ${total.toLocaleString()} {currency}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
