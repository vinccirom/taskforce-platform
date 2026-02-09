import { NextRequest } from "next/server"
import { prisma } from "./prisma"
import { verifyApiKey } from "./api-keys"
import { getAuthUser } from "./auth"
import { Agent, AgentStatus } from "@prisma/client"

export interface AuthenticatedRequest extends NextRequest {
  agent?: Agent
}

/**
 * Dual auth: tries API key first, then Privy cookie.
 * For browser users, auto-creates an agent profile if needed.
 * Use this instead of authenticateAgent when the endpoint serves both humans and agents.
 */
export async function authenticateAgentOrUser(
  request: NextRequest
): Promise<{ agent: Agent } | { error: string; status: number }> {
  // 1. Try API key
  const apiKey = request.headers.get("X-API-Key")
  if (apiKey) {
    return authenticateAgent(request)
  }

  // 2. Try Privy cookie
  try {
    const claims = await getAuthUser()
    if (!claims) {
      return { error: "Authentication required. Please log in.", status: 401 }
    }

    const user = await prisma.user.findUnique({ where: { privyId: claims.userId } })
    if (!user) {
      return { error: "User not found", status: 404 }
    }

    let agent = await prisma.agent.findFirst({ where: { operatorId: user.id } })
    if (!agent) {
      // Auto-create agent profile for human user
      agent = await prisma.agent.create({
        data: {
          name: user.name || user.email?.split("@")[0] || "Worker",
          operatorId: user.id,
          capabilities: ["general"],
          status: AgentStatus.ACTIVE,
          walletAddress: user.walletAddress,
        },
      })
    }

    return { agent }
  } catch (error) {
    console.error("authenticateAgentOrUser cookie auth failed:", error)
    return { error: "Authentication failed", status: 401 }
  }
}

export async function authenticateAgent(
  request: NextRequest
): Promise<{ agent: Agent } | { error: string; status: number }> {
  const apiKey = request.headers.get("X-API-Key")

  if (!apiKey) {
    return {
      error: "API key required. Include X-API-Key header.",
      status: 401,
    }
  }

  if (!apiKey.startsWith("apv_")) {
    return {
      error: "Invalid API key format",
      status: 401,
    }
  }

  // Use key preview (first 12 chars + "...") to narrow candidates
  const keyPreview = apiKey.substring(0, 12) + "..."
  const candidates = await prisma.agentApiKey.findMany({
    where: {
      keyPreview: keyPreview,
      revokedAt: null,
    },
    include: {
      agent: true,
    },
  })

  // Verify the matching candidate(s) with bcrypt
  for (const keyRecord of candidates) {
    const isValid = await verifyApiKey(apiKey, keyRecord.key)

    if (isValid) {
      // Update last used timestamp (fire-and-forget)
      prisma.agentApiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsed: new Date() },
      }).catch(() => {})

      return { agent: keyRecord.agent }
    }
  }

  return {
    error: "Invalid or revoked API key",
    status: 401,
  }
}

export async function requireAgentStatus(
  agent: Agent,
  minStatus: AgentStatus
): Promise<{ authorized: boolean; error?: string }> {
  const statusHierarchy = {
    [AgentStatus.TRIAL]: 0,
    [AgentStatus.VERIFIED_CAPABILITY]: 1,
    [AgentStatus.VERIFIED_OPERATOR]: 2,
    [AgentStatus.ACTIVE]: 3,
    [AgentStatus.SUSPENDED]: -1,
  }

  if (agent.status === AgentStatus.SUSPENDED) {
    return {
      authorized: false,
      error: "Agent is suspended",
    }
  }

  const agentLevel = statusHierarchy[agent.status]
  const requiredLevel = statusHierarchy[minStatus]

  if (agentLevel < requiredLevel) {
    return {
      authorized: false,
      error: `This action requires ${minStatus} status. Current status: ${agent.status}`,
    }
  }

  return { authorized: true }
}
