import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/components/auth/role-guard"
import { resolveDispute } from "@/lib/dispute-jury"

/**
 * POST /api/disputes/[disputeId]/resolve — Human reviewer makes final decision
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  try {
    const { disputeId } = await context.params
    const session = await requireAuth()
    const { decision, notes } = await request.json()

    if (!["WORKER_PAID", "REJECTION_UPHELD"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be WORKER_PAID or REJECTION_UPHELD" },
        { status: 400 }
      )
    }

    // Only admins can resolve disputes
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const result = await resolveDispute(
      disputeId,
      session.user.id,
      decision,
      notes || ""
    )

    return NextResponse.json({
      success: true,
      outcome: result.outcome,
      message: `Dispute resolved: ${result.outcome === "WORKER_PAID" ? "Worker will be paid" : "Rejection upheld"}`,
    })
  } catch (error: any) {
    console.error("Error resolving dispute:", error)
    return NextResponse.json(
      { error: error.message || "Failed to resolve dispute" },
      { status: 500 }
    )
  }
}
