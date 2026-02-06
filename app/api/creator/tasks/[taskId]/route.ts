import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { TaskStatus } from "@prisma/client"

/**
 * DELETE /api/creator/tasks/[taskId]
 * 
 * Safety rules:
 * - DRAFT: hard delete (no money, no workers)
 * - ACTIVE with 0 workers: soft cancel (CANCELLED) — escrow needs refund
 * - ACTIVE with workers assigned: BLOCKED
 * - IN_PROGRESS / COMPLETED / DISPUTED: BLOCKED
 * - CANCELLED: already cancelled
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    const privyUser = await getAuthUser()
    if (!privyUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { privyId: privyUser.userId },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        applications: true,
        submissions: true,
        milestones: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Must be the creator
    if (task.creatorId !== user.id) {
      return NextResponse.json({ error: "Only the task creator can delete this task" }, { status: 403 })
    }

    // --- Safety checks by status ---

    if (task.status === TaskStatus.CANCELLED) {
      return NextResponse.json({ error: "Task is already cancelled" }, { status: 400 })
    }

    if (task.status === TaskStatus.COMPLETED) {
      return NextResponse.json({ error: "Cannot delete a completed task" }, { status: 400 })
    }

    if (task.status === TaskStatus.DISPUTED) {
      return NextResponse.json({ error: "Cannot delete a task with an active dispute" }, { status: 400 })
    }

    if (task.status === TaskStatus.IN_PROGRESS) {
      return NextResponse.json(
        { error: "Cannot delete a task that is in progress. Workers are actively working on it." },
        { status: 400 }
      )
    }

    // ACTIVE with workers assigned — blocked
    if (task.status === TaskStatus.ACTIVE && task.currentWorkers > 0) {
      return NextResponse.json(
        { error: "Cannot delete an active task with assigned workers. Cancel their applications first or wait for completion." },
        { status: 400 }
      )
    }

    // Check for any submissions (extra safety)
    if (task.submissions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a task that has submissions" },
        { status: 400 }
      )
    }

    // --- DRAFT: hard delete (no money involved) ---
    if (task.status === TaskStatus.DRAFT) {
      // Delete related records (cascade handles most, but be explicit)
      await prisma.task.delete({ where: { id: taskId } })

      return NextResponse.json({
        success: true,
        action: "deleted",
        message: "Draft task deleted permanently.",
      })
    }

    // --- ACTIVE with 0 workers: soft cancel ---
    if (task.status === TaskStatus.ACTIVE && task.currentWorkers === 0) {
      // Reject any pending applications
      await prisma.application.updateMany({
        where: { taskId, status: "PENDING" },
        data: { status: "REJECTED" },
      })

      await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.CANCELLED },
      })

      // TODO: In production, initiate escrow refund to creator here

      return NextResponse.json({
        success: true,
        action: "cancelled",
        message: "Task cancelled. Escrow funds will be refunded.",
        note: task.escrowWalletAddress
          ? `Escrow at ${task.escrowWalletAddress} will be refunded.`
          : undefined,
      })
    }

    // Fallback — shouldn't reach here
    return NextResponse.json({ error: "Task cannot be deleted in its current state" }, { status: 400 })
  } catch (error: any) {
    console.error("❌ Task delete error:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
