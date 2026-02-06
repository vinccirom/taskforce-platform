import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateAgent } from "@/lib/api-auth"
import { AgentStatus, TaskStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Authenticate agent
    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { agent } = authResult
    const { taskId } = await params
    const body = await request.json()
    const { feedback, screenshots, duration } = body

    // Validation
    if (!feedback || typeof feedback !== "string") {
      return NextResponse.json(
        { error: "Feedback is required" },
        { status: 400 }
      )
    }

    // Handle trial task submission
    if (taskId === "trial-demo" || taskId.startsWith("trial-")) {
      // Check if agent is in TRIAL status
      if (agent.status !== AgentStatus.TRIAL) {
        return NextResponse.json(
          { error: "Trial task already completed or agent not in trial status" },
          { status: 400 }
        )
      }

      // Check if already completed
      if (agent.trialTestCompleted) {
        return NextResponse.json(
          { error: "Trial task already completed" },
          { status: 400 }
        )
      }

      // Auto-validate trial submission
      const isValid = validateTrialSubmission(feedback, screenshots, duration)

      if (isValid) {
        // Upgrade agent status to VERIFIED_CAPABILITY
        await prisma.agent.update({
          where: { id: agent.id },
          data: {
            status: AgentStatus.VERIFIED_CAPABILITY,
            trialTestCompleted: true,
          },
        })

        return NextResponse.json({
          status: "verified_capability",
          message: "Trial task passed! You can now accept paid tasks.",
          agent: {
            id: agent.id,
            name: agent.name,
            status: AgentStatus.VERIFIED_CAPABILITY,
          },
        })
      } else {
        // Trial failed - keep agent in TRIAL status
        return NextResponse.json({
          status: "trial_failed",
          message: "Trial task incomplete. Please ensure you provide detailed feedback, screenshots, and reasonable completion time.",
          requirements: {
            feedback: "Minimum 50 characters",
            screenshots: "At least 1 screenshot required",
            duration: "Should be between 10-300 seconds",
          },
        }, { status: 400 })
      }
    }

    // Handle regular task submission (paid tasks)
    // Check if agent has an accepted application for this task
    const application = await prisma.application.findFirst({
      where: {
        taskId,
        agentId: agent.id,
        status: "ACCEPTED",
      },
      include: {
        task: true,
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: "No accepted application found for this task" },
        { status: 404 }
      )
    }

    // Check if already submitted
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        applicationId: application.id,
      },
    })

    if (existingSubmission) {
      return NextResponse.json(
        { error: "Submission already exists for this task" },
        { status: 400 }
      )
    }

    const { bugReports, rating, personaUsed } = body

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        applicationId: application.id,
        taskId: application.taskId,
        agentId: agent.id,
        feedback,
        screenshots: screenshots || [],
        deliverable: bugReports || null,
        rating: rating || null,
        timeSpent: duration || null,
        status: "SUBMITTED",
        payoutAmount: application.task.paymentPerWorker ?? application.task.totalBudget,
        payoutStatus: "PENDING",
      },
    })

    // Create evidence records for uploaded files
    const screenshotUrls: string[] = screenshots || []
    if (screenshotUrls.length > 0) {
      await prisma.evidence.createMany({
        data: screenshotUrls.map((url: string) => ({
          submissionId: submission.id,
          url,
          type: detectEvidenceType(url),
          filename: extractFilename(url),
        })),
      })
    }

    // Update application status
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "COMPLETED" },
    })

    // Move task to IN_PROGRESS if still ACTIVE
    if (application.task.status === TaskStatus.ACTIVE) {
      await prisma.task.update({
        where: { id: application.taskId },
        data: { status: TaskStatus.IN_PROGRESS },
      })
    }

    // Update agent stats
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        completedTests: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        status: submission.status,
        payoutAmount: submission.payoutAmount,
        payoutStatus: submission.payoutStatus,
        submittedAt: submission.submittedAt,
      },
      message: "Submission received. Waiting for creator approval.",
    })

  } catch (error) {
    console.error("Task submission error:", error)
    return NextResponse.json(
      { error: "Failed to submit task. Please try again." },
      { status: 500 }
    )
  }
}

function validateTrialSubmission(
  feedback: string,
  screenshots: string[] | undefined,
  duration: number | undefined
): boolean {
  // Check feedback length
  if (!feedback || feedback.length < 50) {
    return false
  }

  // Check screenshots (at least 1 required)
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length < 1) {
    return false
  }

  // Check duration (should be reasonable - between 10 seconds and 5 minutes)
  if (!duration || duration < 10 || duration > 300) {
    return false
  }

  // All checks passed
  return true
}

function detectEvidenceType(url: string): string {
  const lower = url.toLowerCase()
  if (/\.(png|jpg|jpeg|gif|webp|svg)/.test(lower)) return "screenshot"
  if (/\.(pdf|doc|docx|txt|csv)/.test(lower)) return "document"
  if (/\.(js|ts|html|css|json|py|jsx|tsx)/.test(lower)) return "code"
  if (/\.(zip|gz|tar|rar|7z)/.test(lower)) return "archive"
  return "screenshot" // default
}

function extractFilename(url: string): string {
  try {
    const parts = url.split("/")
    const last = parts[parts.length - 1]
    // Remove query params and timestamp prefix
    return last.split("?")[0].replace(/^\d+-/, "")
  } catch {
    return "unknown"
  }
}
