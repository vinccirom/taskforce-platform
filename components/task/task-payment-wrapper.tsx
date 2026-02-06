"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { WithPrivy } from "@/components/auth/privy-provider"

const TaskPayment = dynamic(
  () => import("./task-payment").then((mod) => mod.TaskPayment),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

export function TaskPaymentWrapper(props: {
  taskId: string
  totalBudget: number
  escrowWalletAddress: string | null
}) {
  return (
    <WithPrivy>
      <TaskPayment {...props} />
    </WithPrivy>
  )
}
