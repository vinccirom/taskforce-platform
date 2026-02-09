import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { TaskStatus } from "@prisma/client"
import { refundEscrowToCreator } from "@/lib/payment"

async function getAgentAsCreator(request: NextRequest) {
  const authResult = await authenticateAgent(request)
  if ("error" in authResult) {
    return { error: authResult.error, status: authResult.status }
  }
  const { agent } = authResult
  if (!agent.operatorId) {
    return { error: "Agent has no linked operator. Cannot manage created tasks.", status: 403 }
  }
  return { agent, operatorId: agent.operatorId }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const auth = await getAgentAsCreator(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        applications: {
          include: {
            agent: {
              select: { id: true, name: true, reputation: true, completedTests: true, status: true },
            },
          },
        },
        submissions: {
          include: {
            agent: { select: { id: true, name: true } },
          },
        },
        milestones: { orderBy: { order: "asc" } },
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    if (task.creatorId !== auth.operatorId) {
      return NextResponse.json({ error: "Not authorized — you don't own this task" }, { status: 403 })
    }

    return NextResponse.json({ success: true, task })
  } catch (error: any) {
    console.error("❌ Agent task manage GET error:", error)
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const auth = await getAgentAsCreator(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { applications: true, submissions: true, milestones: true },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }
    if (task.creatorId !== auth.operatorId) {
      return NextResponse.json({ error: "Not authorized — you don't own this task" }, { status: 403 })
    }

    // Safety checks mirroring creator DELETE endpoint
    if (task.status === TaskStatus.CANCELLED) {
      return NextResponse.json({ error: "Task is already cancelled" }, { status: 400 })
    }
    if (task.status === TaskStatus.COMPLETED) {
      return NextResponse.json({ error: "Cannot cancel a completed task" }, { status: 400 })
    }
    if (task.status === TaskStatus.DISPUTED) {
      return NextResponse.json({ error: "Cannot cancel a task with an active dispute" }, { status: 400 })
    }
    if (task.status === TaskStatus.IN_PROGRESS) {
      return NextResponse.json({ error: "Cannot cancel a task that is in progress" }, { status: 400 })
    }
    if (task.status === TaskStatus.ACTIVE && task.currentWorkers > 0) {
      return NextResponse.json({ error: "Cannot cancel an active task with assigned workers" }, { status: 400 })
    }
    if (task.submissions.length > 0) {
      return NextResponse.json({ error: "Cannot cancel a task that has submissions" }, { status: 400 })
    }

    // DRAFT: hard delete
    if (task.status === TaskStatus.DRAFT) {
      await prisma.task.delete({ where: { id: taskId } })
      return NextResponse.json({ success: true, action: "deleted", message: "Draft task deleted permanently." })
    }

    // ACTIVE with 0 workers: soft cancel
    if (task.status === TaskStatus.ACTIVE && task.currentWorkers === 0) {
      await prisma.application.updateMany({
        where: { taskId, status: "PENDING" },
        data: { status: "REJECTED" },
      })

      await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.CANCELLED },
      })

      // Refund escrow
      const operator = await prisma.user.findUnique({ where: { id: auth.operatorId } })
      let refundResult: any = null
      if (task.escrowWalletId && task.escrowWalletAddress && operator?.walletAddress) {
        refundResult = await refundEscrowToCreator(
          operator.walletAddress,
          task.escrowWalletId,
          task.escrowWalletAddress,
          task.totalBudget,
        )
        if (!refundResult.success) {
          console.error(`⚠️ Task ${taskId} cancelled but refund failed: ${refundResult.error}`)
        }
      }

      return NextResponse.json({
        success: true,
        action: "cancelled",
        message: refundResult?.success
          ? `Task cancelled. ${(task.totalBudget * 0.95).toFixed(2)} USDC refunded (5% cancellation fee applied).`
          : "Task cancelled. Refund will be processed manually.",
        transactionHash: refundResult?.transactionHash,
      })
    }

    return NextResponse.json({ error: "Task cannot be cancelled in its current state" }, { status: 400 })
  } catch (error: any) {
    console.error("❌ Agent task cancel error:", error)
    return NextResponse.json({ error: "Failed to cancel task" }, { status: 500 })
  }
}
