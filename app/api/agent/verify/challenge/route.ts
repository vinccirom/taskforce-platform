import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashApiKey } from "@/lib/api-keys"
import { createChallenge } from "@/lib/agent-challenges"
import { AgentStatus } from "@prisma/client"

/**
 * POST /api/agent/verify/challenge
 * Request a verification challenge. Agent must be in TRIAL status.
 * Auth: API key in Authorization header
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

    // Check if already verified
    if (agent.status === AgentStatus.ACTIVE) {
      return NextResponse.json({
        error: "Agent is already verified",
        status: agent.status,
      }, { status: 400 })
    }

    // Check retry limit (max 3 failed attempts tracked in DB)
    if (agent.trialAttempts && agent.trialAttempts >= 3) {
      return NextResponse.json({
        error: "Maximum verification attempts reached (3). Contact support.",
      }, { status: 429 })
    }

    // Generate challenge
    const challenge = createChallenge()

    return NextResponse.json({
      challengeId: challenge.challengeId,
      prompt: challenge.prompt,
      expiresIn: 30,
      expiresAt: new Date(challenge.expiresAt).toISOString(),
      instructions: "Send your answer to POST /api/agent/verify/submit within 30 seconds.",
      attemptsRemaining: 3 - (agent.trialAttempts || 0),
    })
  } catch (error: any) {
    console.error("Challenge generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500 }
    )
  }
}
