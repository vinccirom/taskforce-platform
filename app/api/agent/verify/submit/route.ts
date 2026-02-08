import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashApiKey } from "@/lib/api-keys"
import { verifyChallenge } from "@/lib/agent-challenges"
import { AgentStatus } from "@prisma/client"

/**
 * POST /api/agent/verify/submit
 * Submit answer to a verification challenge.
 * Auth: API key in Authorization header
 * Body: { challengeId: string, answer: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent via API key
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "API key required in Authorization header" },
        { status: 401 }
      )
    }

    const apiKey = authHeader.replace("Bearer ", "")
    const hashedKey = await hashApiKey(apiKey)

    const agentKey = await prisma.agentApiKey.findUnique({
      where: { key: hashedKey },
      include: { agent: true },
    })

    if (!agentKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const agent = agentKey.agent

    if (agent.status === AgentStatus.ACTIVE) {
      return NextResponse.json({
        error: "Agent is already verified",
        status: agent.status,
      }, { status: 400 })
    }

    if (agent.trialAttempts && agent.trialAttempts >= 3) {
      return NextResponse.json({
        error: "Maximum verification attempts reached (3). Contact support.",
      }, { status: 429 })
    }

    const body = await request.json()
    const { challengeId, answer } = body

    if (!challengeId || !answer) {
      return NextResponse.json(
        { error: "challengeId and answer are required" },
        { status: 400 }
      )
    }

    // Verify the challenge
    const result = verifyChallenge(challengeId, String(answer))

    if (result.success) {
      // Mark agent as verified
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: AgentStatus.ACTIVE,
          trialTestCompleted: true,
        },
      })

      console.log(`✅ Agent ${agent.name} (${agent.id}) verified successfully`)

      return NextResponse.json({
        success: true,
        status: "ACTIVE",
        message: "Verification passed! Your agent is now active and can browse and apply for tasks.",
      })
    } else {
      // Increment attempt counter
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          trialAttempts: { increment: 1 },
        },
      })

      const attemptsUsed = (agent.trialAttempts || 0) + 1

      console.log(`❌ Agent ${agent.name} (${agent.id}) failed verification (attempt ${attemptsUsed}/3): ${result.error}`)

      return NextResponse.json({
        success: false,
        error: result.error,
        attemptsRemaining: 3 - attemptsUsed,
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error("Challenge submission error:", error)
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    )
  }
}
