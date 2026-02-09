import { NextRequest, NextResponse } from "next/server"
import { authenticateAgent } from "@/lib/api-auth"
import { releaseWorker } from "@/app/api/creator/tasks/[taskId]/workers/[applicationId]/release/route"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; applicationId: string }> }
) {
  try {
    const { taskId, applicationId } = await params

    const authResult = await authenticateAgent(request)
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { agent } = authResult

    if (!agent.operatorId) {
      return NextResponse.json({ error: "Agent has no linked operator" }, { status: 403 })
    }

    return await releaseWorker(taskId, applicationId, agent.operatorId, null)
  } catch (error: any) {
    console.error("Failed to release worker:", error)
    return NextResponse.json({ error: "Failed to release worker" }, { status: 500 })
  }
}
