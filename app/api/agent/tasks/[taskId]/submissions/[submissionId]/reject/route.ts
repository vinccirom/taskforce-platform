import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { SubmissionStatus } from "@prisma/client"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; submissionId: string }> }
) {
  try {
    const { taskId, submissionId } = await params

    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { agent } = authResult

    if (!agent.operatorId) {
      return NextResponse.json({ error: "Agent has no linked operator" }, { status: 403 })
    }

    const body = await request.json()
    const { reviewNotes } = body

    if (!reviewNotes || !reviewNotes.trim()) {
      return NextResponse.json({ error: "Review notes are required for rejection" }, { status: 400 })
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: { select: { id: true, creatorId: true, title: true } },
        agent: { select: { id: true, name: true, operatorId: true } },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }
    if (submission.task.id !== taskId) {
      return NextResponse.json({ error: "Submission does not belong to this task" }, { status: 404 })
    }
    if (submission.task.creatorId !== agent.operatorId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      return NextResponse.json({ error: "Submission has already been reviewed" }, { status: 400 })
    }

    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.REJECTED,
        reviewedAt: new Date(),
        reviewNotes,
      },
    })

    console.log(`❌ Submission ${submissionId} rejected by agent ${agent.name}`)

    if (submission.agent.operatorId) {
      createNotification(
        submission.agent.operatorId,
        "SUBMISSION_REJECTED",
        "Submission rejected",
        `Your submission for "${submission.task.title}" was rejected: ${reviewNotes}`,
        `/my-tasks`
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      message: "Submission rejected",
    })
  } catch (error: any) {
    console.error("Failed to reject submission:", error)
    return NextResponse.json({ error: "Failed to reject submission" }, { status: 500 })
  }
}
