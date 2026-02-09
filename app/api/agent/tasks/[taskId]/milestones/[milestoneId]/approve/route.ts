import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { MilestoneStatus, TaskStatus } from "@prisma/client"
import { transferUsdcToAgent } from "@/lib/payment"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; milestoneId: string }> }
) {
  try {
    const { taskId, milestoneId } = await params

    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { agent } = authResult

    if (!agent.operatorId) {
      return NextResponse.json({ error: "Agent has no linked operator" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { feedback } = body

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        task: {
          include: {
            applications: {
              where: { status: "ACCEPTED" },
              include: {
                agent: { select: { id: true, name: true, walletAddress: true, operatorId: true } },
              },
            },
          },
        },
      },
    })

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
    }
    if (milestone.taskId !== taskId) {
      return NextResponse.json({ error: "Milestone does not belong to this task" }, { status: 404 })
    }
    if (milestone.task.creatorId !== agent.operatorId) {
      return NextResponse.json({ error: "Not authorized to approve this milestone" }, { status: 403 })
    }
    if (milestone.status !== MilestoneStatus.UNDER_REVIEW) {
      return NextResponse.json(
        { error: `Milestone must be under review to approve (current status: ${milestone.status})` },
        { status: 400 }
      )
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: MilestoneStatus.COMPLETED, completedAt: new Date() },
    })

    console.log(`✅ Milestone ${milestoneId} approved by agent ${agent.name}`)

    // Notify workers of approval
    for (const app of milestone.task.applications) {
      if (app.agent.operatorId) {
        createNotification(
          app.agent.operatorId,
          "MILESTONE_APPROVED",
          "Milestone approved!",
          `Milestone "${milestone.title}" on "${milestone.task.title}" was approved`,
          `/my-tasks`
        ).catch(() => {})
      }
    }

    // Check if all milestones completed
    const allMilestones = await prisma.milestone.findMany({ where: { taskId: milestone.taskId } })
    const allCompleted = allMilestones.every(m => m.status === MilestoneStatus.COMPLETED)
    if (allCompleted) {
      await prisma.task.update({
        where: { id: milestone.taskId },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      })
      console.log(`🎉 Task ${milestone.taskId} auto-completed — all milestones done`)
    }

    // Pay the accepted worker
    let payoutResult: any = null
    const acceptedApp = milestone.task.applications[0]
    if (acceptedApp?.agent?.walletAddress && milestone.amount) {
      payoutResult = await transferUsdcToAgent(
        acceptedApp.agent.walletAddress,
        milestone.amount,
        milestone.task.escrowWalletId ?? undefined,
        milestone.task.escrowWalletAddress ?? undefined,
        milestone.task.paymentChain === 'EVM' ? 'base' : 'solana',
      )

      if (payoutResult.success) {
        console.log(`💰 Milestone ${milestoneId} payout: ${milestone.amount} USDC to ${acceptedApp.agent.name}`)
      } else {
        console.error(`⚠️ Milestone ${milestoneId} payout failed: ${payoutResult.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      milestone: updatedMilestone,
      message: payoutResult?.success
        ? `Milestone approved! ${milestone.amount} USDC released to worker.`
        : "Milestone approved! Payment will be processed.",
      transactionHash: payoutResult?.transactionHash,
    })
  } catch (error: any) {
    console.error("❌ Agent milestone approval error:", error)
    return NextResponse.json({ error: "Failed to approve milestone" }, { status: 500 })
  }
}
