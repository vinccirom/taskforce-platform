import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import { TaskStatus, PaymentType } from "@prisma/client"

/**
 * PATCH /api/creator/tasks/[taskId]/edit
 * 
 * Safety rules by status:
 * - DRAFT: everything editable (title, description, budget, milestones, etc.)
 * - ACTIVE / IN_PROGRESS: only non-financial fields (description, requirements, credentials, referenceUrl, deadline, skillsRequired)
 * - COMPLETED / CANCELLED / DISPUTED: NO editing
 */

const ALWAYS_EDITABLE = [
  "title",
  "description",
  "referenceUrl",
  "credentials",
  "requirements",
  "skillsRequired",
  "deadline",
] as const

const DRAFT_ONLY_EDITABLE = [
  "category",
  "totalBudget",
  "paymentType",
  "paymentPerWorker",
  "maxWorkers",
  "milestones",
] as const

export async function PATCH(
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
      include: { milestones: { orderBy: { order: "asc" } } },
    })

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    if (task.creatorId !== user.id) {
      return NextResponse.json({ error: "Only the task creator can edit this task" }, { status: 403 })
    }

    // --- Status checks ---
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.CANCELLED ||
      task.status === TaskStatus.DISPUTED
    ) {
      return NextResponse.json(
        { error: `Cannot edit a ${task.status.toLowerCase()} task` },
        { status: 400 }
      )
    }

    const isDraft = task.status === TaskStatus.DRAFT
    const body = await request.json()

    // Build update data — only allow permitted fields
    const updateData: any = {}

    // Always-editable fields
    if (body.title !== undefined) {
      if (!body.title?.trim() || body.title.length < 5) {
        return NextResponse.json({ error: "Title must be at least 5 characters" }, { status: 400 })
      }
      updateData.title = body.title.trim()
    }
    if (body.description !== undefined) {
      if (!body.description?.trim() || body.description.length < 20) {
        return NextResponse.json({ error: "Description must be at least 20 characters" }, { status: 400 })
      }
      updateData.description = body.description.trim()
    }
    if (body.requirements !== undefined) {
      if (!body.requirements?.trim() || body.requirements.length < 10) {
        return NextResponse.json({ error: "Requirements must be at least 10 characters" }, { status: 400 })
      }
      updateData.requirements = body.requirements.trim()
    }
    if (body.referenceUrl !== undefined) {
      updateData.referenceUrl = body.referenceUrl?.trim() || null
    }
    if (body.credentials !== undefined) {
      updateData.credentials = body.credentials?.trim() || null
    }
    if (body.skillsRequired !== undefined) {
      updateData.skillsRequired = Array.isArray(body.skillsRequired)
        ? body.skillsRequired
        : []
    }
    if (body.deadline !== undefined) {
      updateData.deadline = body.deadline ? new Date(body.deadline) : null
    }

    // Draft-only fields — reject if non-draft tries to change them
    if (!isDraft) {
      const blockedFields = DRAFT_ONLY_EDITABLE.filter((f) => body[f] !== undefined)
      if (blockedFields.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot change ${blockedFields.join(", ")} on an ${task.status.toLowerCase()} task. Only draft tasks allow financial/structural changes.`,
          },
          { status: 400 }
        )
      }
    } else {
      // DRAFT — allow financial/structural changes
      if (body.category !== undefined) {
        if (!body.category?.trim()) {
          return NextResponse.json({ error: "Category is required" }, { status: 400 })
        }
        updateData.category = body.category
      }
      if (body.totalBudget !== undefined) {
        if (typeof body.totalBudget !== "number" || body.totalBudget < 1) {
          return NextResponse.json({ error: "Total budget must be at least $1" }, { status: 400 })
        }
        updateData.totalBudget = body.totalBudget
      }
      if (body.paymentType !== undefined) {
        if (!["FIXED", "MILESTONE"].includes(body.paymentType)) {
          return NextResponse.json({ error: "Invalid payment type" }, { status: 400 })
        }
        updateData.paymentType = body.paymentType
      }
      if (body.paymentPerWorker !== undefined) {
        updateData.paymentPerWorker = body.paymentPerWorker
      }
      if (body.maxWorkers !== undefined) {
        if (body.maxWorkers < 1 || body.maxWorkers > 100) {
          return NextResponse.json({ error: "Max workers must be 1-100" }, { status: 400 })
        }
        updateData.maxWorkers = body.maxWorkers
      }
    }

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    })

    // Handle milestones (draft only)
    if (isDraft && body.milestones !== undefined) {
      const effectivePaymentType = updateData.paymentType || task.paymentType
      const effectiveBudget = updateData.totalBudget || task.totalBudget

      if (effectivePaymentType === PaymentType.MILESTONE) {
        if (!Array.isArray(body.milestones) || body.milestones.length < 2) {
          return NextResponse.json(
            { error: "Milestone-based tasks require at least 2 milestones" },
            { status: 400 }
          )
        }

        const totalPct = body.milestones.reduce(
          (sum: number, m: any) => sum + (m.percentage || 0),
          0
        )
        if (totalPct !== 100) {
          return NextResponse.json(
            { error: `Milestone percentages must sum to 100% (got ${totalPct}%)` },
            { status: 400 }
          )
        }

        // Replace all milestones
        await prisma.milestone.deleteMany({ where: { taskId } })
        await prisma.milestone.createMany({
          data: body.milestones.map((m: any, i: number) => ({
            taskId,
            title: m.title,
            description: m.description || null,
            order: i + 1,
            percentage: m.percentage,
            amount: (effectiveBudget * m.percentage) / 100,
          })),
        })
      } else {
        // If switched to FIXED, remove milestones
        await prisma.milestone.deleteMany({ where: { taskId } })
      }
    }

    // Return updated task with milestones
    const result = await prisma.task.findUnique({
      where: { id: taskId },
      include: { milestones: { orderBy: { order: "asc" } } },
    })

    return NextResponse.json({
      success: true,
      task: result,
      message: "Task updated successfully.",
    })
  } catch (error: any) {
    console.error("❌ Task edit error:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}
