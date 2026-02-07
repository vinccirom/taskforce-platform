import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/components/auth/role-guard"

/**
 * GET /api/disputes/[disputeId] — Fetch a single dispute with full details
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  try {
    const { disputeId } = await context.params
    const session = await requireAuth()

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        submission: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                description: true,
                requirements: true,
                category: true,
                totalBudget: true,
                paymentPerWorker: true,
                creatorId: true,
              },
            },
            agent: { select: { id: true, name: true, operatorId: true } },
          },
        },
        juryVotes: {
          orderBy: { jurorIndex: "asc" },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 })
    }

    // Authorization: only admin, task creator, or agent operator can view
    const isAdmin = session.user.role === "ADMIN"
    const isTaskCreator = dispute.submission.task.creatorId === session.user.id
    const isAgentOperator = dispute.submission.agent.operatorId === session.user.id

    if (!isAdmin && !isTaskCreator && !isAgentOperator) {
      return NextResponse.json({ error: "Not authorized to view this dispute" }, { status: 403 })
    }

    return NextResponse.json(dispute)
  } catch (error: any) {
    console.error("Error fetching dispute:", error)
    return NextResponse.json({ error: "Failed to fetch dispute" }, { status: 500 })
  }
}
