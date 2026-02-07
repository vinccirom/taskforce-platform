import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/components/auth/role-guard"
import { runJuryReview } from "@/lib/dispute-jury"

const DISPUTE_WINDOW_HOURS = 48

/**
 * POST /api/disputes — File a dispute on a rejected submission
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }
    const { submissionId, reason } = body

    if (!submissionId || !reason?.trim()) {
      return NextResponse.json(
        { error: "submissionId and reason are required" },
        { status: 400 }
      )
    }

    // Fetch submission and verify the worker owns it
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        agent: { select: { operatorId: true } },
        dispute: true,
      },
    })

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    if (submission.agent.operatorId !== session.user.id) {
      return NextResponse.json({ error: "Not your submission" }, { status: 403 })
    }

    if (submission.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Can only dispute rejected submissions" },
        { status: 400 }
      )
    }

    if (submission.dispute) {
      return NextResponse.json(
        { error: "This submission already has a dispute" },
        { status: 400 }
      )
    }

    // Check dispute window
    const rejectedAt = submission.reviewedAt || submission.submittedAt
    const hoursElapsed = (Date.now() - rejectedAt.getTime()) / (1000 * 60 * 60)
    if (hoursElapsed > DISPUTE_WINDOW_HOURS) {
      return NextResponse.json(
        { error: `Dispute window has expired (${DISPUTE_WINDOW_HOURS}h after rejection)` },
        { status: 400 }
      )
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        submissionId,
        reason: reason.trim(),
        status: "OPEN",
      },
    })

    // Update submission status
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "DISPUTED", payoutStatus: "DISPUTED" },
    })

    // Kick off AI jury review (async — don't await)
    runJuryReview(dispute.id).catch((err) => {
      console.error(`Jury review failed for dispute ${dispute.id}:`, err)
    })

    return NextResponse.json({
      id: dispute.id,
      status: dispute.status,
      message: "Dispute filed. AI jury review has been initiated.",
    })
  } catch (error: any) {
    console.error("Error filing dispute:", error)
    return NextResponse.json(
      { error: "Failed to file dispute" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/disputes — List disputes (for admin/human reviewer)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const isAdmin = session.user.role === "ADMIN"

    // Build where clause: admins see all, others only see their own disputes
    const baseWhere = status ? { status: status as any } : {}
    const where = isAdmin
      ? baseWhere
      : {
          ...baseWhere,
          OR: [
            { submission: { task: { creatorId: session.user.id } } },
            { submission: { agent: { operatorId: session.user.id } } },
          ],
        }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        submission: {
          include: {
            task: { select: { id: true, title: true, category: true, totalBudget: true, creatorId: true } },
            agent: { select: { id: true, name: true, operatorId: true } },
          },
        },
        juryVotes: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(disputes)
  } catch (error: any) {
    console.error("Error fetching disputes:", error)
    return NextResponse.json({ error: "Failed to fetch disputes" }, { status: 500 })
  }
}
